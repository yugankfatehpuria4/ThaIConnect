import hmac
import json
import logging
import os
import subprocess
import sys
import threading
from functools import wraps
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from flask import Flask, request, jsonify
from flask_cors import CORS
from openai import OpenAI
import httpx
from dotenv import load_dotenv

ENV_PATH = Path(__file__).resolve().parent / '.env'
load_dotenv(dotenv_path=ENV_PATH, override=True)

# Structured logging so production failures are visible (chat errors used to be
# swallowed silently). load_dotenv() already populated os.environ, so config is
# read from there — no re-parsing .env from disk on every request.
logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s [%(name)s] %(message)s')
logger = logging.getLogger('thalai-ai')

# Serialize lazy model loading across threads (e.g. gunicorn gthread workers).
_model_lock = threading.Lock()

app = Flask(__name__)
# Only allow requests from trusted backend origins, not the public internet.
backend_origins = [
    origin.strip()
    for origin in os.environ.get(
        'BACKEND_ORIGINS',
        'http://localhost:5002,http://127.0.0.1:5002'
    ).split(',')
    if origin.strip()
]
CORS(app, origins=backend_origins)

ROOT_DIR = Path(__file__).resolve().parents[1]
ML_DATA_DIR = ROOT_DIR / 'backend' / 'ml-data'
DATASET_SCRIPT = ML_DATA_DIR / 'build_final_patient_dataset.py'

MODEL_FILES = {
    'binary': ML_DATA_DIR / 'anemia_binary.joblib',
    'type':   ML_DATA_DIR / 'anemia_type.joblib',
    'hgb':    ML_DATA_DIR / 'hgb_regressor.joblib',
    'thal':   ML_DATA_DIR / 'thal_screener.joblib',
}
MODEL_CACHE = {'binary': None, 'type': None, 'hgb': None, 'thal': None}

# Model metadata (feature order + class labels + screening threshold) is the
# single source of truth, produced by ml-data/train_models.py. Loading labels
# from here keeps predictions and their names in sync with the trained models.
METADATA_FILE = ML_DATA_DIR / 'model_metadata.json'
try:
    MODEL_METADATA = json.loads(METADATA_FILE.read_text()).get('models', {})
except (OSError, ValueError):
    MODEL_METADATA = {}

# ─── API Key Auth (issue #7) ──────────────────────────────────────────────────
def require_api_key(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        expected = os.environ.get('AI_SERVICE_API_KEY', '')
        provided = request.headers.get('X-API-Key', '')
        # Constant-time comparison to avoid leaking the key via timing.
        if not expected or not hmac.compare_digest(provided, expected):
            return jsonify({'error': 'Unauthorized'}), 401
        return f(*args, **kwargs)
    return decorated


def get_openai_client():
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key or api_key.startswith('your_'):
        return None
    base_url = os.environ.get("OPENAI_BASE_URL")
    if not base_url and api_key.startswith('xai-'):
        base_url = "https://api.x.ai/v1"
    return OpenAI(
        api_key=api_key,
        base_url=base_url or None,
        http_client=httpx.Client(timeout=20.0)
    )


def build_fallback_reply(user_message: str) -> str:
    message = user_message.lower()

    if any(term in message for term in ['transfusion', 'hb', 'hemoglobin', 'haemoglobin', 'anemia', 'anaemia']):
        return (
            "I’m here to help with transfusion planning and symptom tracking. "
            "Please share your latest Hb, next transfusion date, and any symptoms, "
            "and I can help summarize what to discuss with your doctor."
        )

    if any(term in message for term in ['donor', 'sos', 'blood']):
        return (
            "I can help you think through donor matching and emergency SOS steps. "
            "If this is urgent, please contact your care team or local emergency services right away."
        )

    return (
        "I’m unable to reach the AI provider right now, but I can still help with "
        "transfusion reminders, donor matching questions, and general ThalAI Connect guidance."
    )


def is_auth_key_error(exc: Exception) -> bool:
    message = str(exc).lower()
    return any(term in message for term in [
        'incorrect api key provided',
        'authentication error',
        'invalid api key',
        'unauthorized',
        'api key not found',
    ])


def classify_hb(hb: float) -> str:
    if hb < 8:
        return 'Severe'
    if hb < 10:
        return 'Moderate'
    return 'Mild'


def normalize_gender(value):
    if isinstance(value, str):
        v = value.strip().lower()
        if v in {'male', 'm', '1'}:
            return 1
        if v in {'female', 'f', '0'}:
            return 0
    try:
        return 1 if int(value) == 1 else 0
    except Exception:
        return 0


def load_models():
    # Double-checked locking: the fast path skips the lock once loaded.
    if all(MODEL_CACHE.get(k) is not None for k in MODEL_FILES):
        return MODEL_CACHE
    with _model_lock:
        for key, path in MODEL_FILES.items():
            if MODEL_CACHE.get(key) is None:
                MODEL_CACHE[key] = joblib.load(path)
    return MODEL_CACHE


def preprocess_payload(payload):
    def number(name, default=None, *, minimum=None, maximum=None, required=False):
        raw = payload.get(name, None)
        if raw is None or raw == '':
            # Never silently fabricate a core medical reading — reject instead.
            if required:
                raise ValueError(f'{name} is required')
            raw = default
        try:
            value = float(raw)
        except (TypeError, ValueError):
            raise ValueError(f'{name} must be a number') from None
        if minimum is not None and value < minimum:
            raise ValueError(f'{name} must be at least {minimum}')
        if maximum is not None and value > maximum:
            raise ValueError(f'{name} must be at most {maximum}')
        return value

    def integer(name, default, *, minimum=None, maximum=None):
        return int(number(name, default, minimum=minimum, maximum=maximum))

    if not payload.get('gender'):
        raise ValueError('gender is required')

    # Core CBC values that make the prediction meaningful are REQUIRED. Secondary
    # counts the app doesn't collect (differentials, pdw/pct) keep sane defaults.
    return {
        'age':           number('age', minimum=0, maximum=120, required=True),
        'gender':        payload.get('gender'),
        'hemoglobin':    number('hemoglobin', minimum=0, maximum=25, required=True),
        'platelets':     number('platelets', 180, minimum=0),
        'ferritin':      number('ferritin', 1200, minimum=0),
        'mcv':           number('mcv', minimum=0, required=True),
        'mch':           number('mch', minimum=0, required=True),
        'mchc':          number('mchc', minimum=0, required=True),
        'wbc':           number('wbc', 8.5, minimum=0),
        'lymp':          number('lymp', 30, minimum=0),
        'neutp':         number('neutp', 60, minimum=0),
        'lymn':          number('lymn', 2.5, minimum=0),
        'neutn':         number('neutn', 5.2, minimum=0),
        'rbc':           number('rbc', minimum=0, required=True),
        'hct':           number('hct', 32, minimum=0),
        'pdw':           number('pdw', 12.5, minimum=0),
        'pct':           number('pct', 0.2, minimum=0),
        'rdw':           number('rdw', 13.0, minimum=0),
        'tlc':           number('tlc', 7.8, minimum=0),
        'avg_cycle_days': integer('avg_cycle_days', 21, minimum=1, maximum=365),
    }


def build_features(payload):
    p = preprocess_payload(payload)
    binary_input = pd.DataFrame([{'Gender': normalize_gender(p['gender']), 'Hemoglobin': p['hemoglobin'], 'MCH': p['mch'], 'MCHC': p['mchc'], 'MCV': p['mcv']}])
    type_input = pd.DataFrame([{'WBC': p['wbc'], 'LYMp': p['lymp'], 'NEUTp': p['neutp'], 'LYMn': p['lymn'], 'NEUTn': p['neutn'], 'RBC': p['rbc'], 'HGB': p['hemoglobin'], 'HCT': p['hct'], 'MCV': p['mcv'], 'MCH': p['mch'], 'MCHC': p['mchc'], 'PLT': p['platelets'], 'PDW': p['pdw'], 'PCT': p['pct']}])
    hgb_input = pd.DataFrame([{'age': p['age'], 'sex': normalize_gender(p['gender']), 'rbc': p['rbc'], 'pcv': p['hct'], 'mcv': p['mcv'], 'mch': p['mch'], 'mchc': p['mchc'], 'rdw': p['rdw'], 'tlc': p['tlc'], 'plt__per_mm3': p['platelets']}])
    thal_input = pd.DataFrame([{'age': p['age'], 'sex': normalize_gender(p['gender']), 'rbc': p['rbc'], 'hemoglobin': p['hemoglobin'], 'mcv': p['mcv'], 'mch': p['mch'], 'mchc': p['mchc'], 'rdw': p['rdw']}])
    return p, binary_input, type_input, hgb_input, thal_input


def label_for(model_key: str, class_id: int) -> str:
    """Resolve a model's class id to its human label using the trained-model
    metadata, so names always match what the model actually learned."""
    labels = MODEL_METADATA.get(model_key, {}).get('labels', {})
    return labels.get(str(class_id), f'Class-{class_id}')


def screen_thalassaemia(model, thal_input):
    """Return the thalassaemia screening result for one patient. Flags on
    P(abnormal) >= the trained screening threshold (sensitivity-favoured), so a
    flag means 'refer for confirmatory HPLC', not a diagnosis."""
    meta = MODEL_METADATA.get('thal', {})
    labels = meta.get('labels', {})
    normal_label = meta.get('normal_label', 'Normal')
    threshold = meta.get('screening_threshold', 0.5)

    proba = model.predict_proba(thal_input)[0]
    classes = list(getattr(model, 'classes_', range(len(proba))))
    prob_by_label = {labels.get(str(int(c)), f'Class-{int(c)}'): float(pr)
                     for c, pr in zip(classes, proba)}

    p_normal = prob_by_label.get(normal_label, 0.0)
    p_abnormal = round(1.0 - p_normal, 4)
    # Most likely specific hemoglobinopathy (best non-Normal label).
    abnormal_probs = {k: v for k, v in prob_by_label.items() if k != normal_label}
    likely_type = max(abnormal_probs, key=abnormal_probs.get) if abnormal_probs else None

    flagged = p_abnormal >= threshold
    return {
        'flagged': bool(flagged),
        'riskProbability': p_abnormal,
        'likelyType': likely_type if flagged else None,
        'likelyTypeProbability': round(abnormal_probs.get(likely_type, 0.0), 4) if flagged and likely_type else None,
        'recommendation': ('Refer for confirmatory HPLC / Hb electrophoresis'
                           if flagged else 'Low hemoglobinopathy risk on routine CBC'),
        'screeningThreshold': threshold,
        'disclaimer': 'CBC-based screening only — not a diagnosis. Confirm with HPLC.',
    }


# ─── Routes ───────────────────────────────────────────────────────────────────

@app.route('/api/ml/health', methods=['GET'])
def ml_health():
    # Public liveness/readiness endpoint — no API key. The platform health check
    # (Render) and load balancers must be able to hit this unauthenticated. The
    # payload only reports whether model files exist, which is not sensitive.
    return jsonify({'models': {k: v.exists() for k, v in MODEL_FILES.items()}, 'dataset_builder': DATASET_SCRIPT.exists()})


@app.route('/api/ml/build-dataset', methods=['POST'])
@require_api_key
def build_dataset():
    if not DATASET_SCRIPT.exists():
        logger.error('Dataset builder missing at %s', DATASET_SCRIPT)
        return jsonify({'error': 'Dataset builder is not available'}), 404
    try:
        result = subprocess.run([sys.executable, str(DATASET_SCRIPT)], cwd=str(ML_DATA_DIR), capture_output=True, text=True, check=True)
        logger.info('Dataset build OK: %s', (result.stdout or '').strip()[:500])
        output_file = ML_DATA_DIR / 'final_patient_dataset.csv'
        # Don't return raw stdout or absolute server paths to the caller.
        return jsonify({'success': True, 'dataset': output_file.name, 'exists': output_file.exists()})
    except subprocess.CalledProcessError as exc:
        logger.error('Dataset build failed: %s', (exc.stderr or exc.stdout or '')[:1000])
        return jsonify({'error': 'Dataset build failed'}), 500


@app.route('/api/ml/predict', methods=['POST'])
@require_api_key
def ml_predict():
    payload = request.json or {}
    if not isinstance(payload, dict):
        return jsonify({'error': 'JSON body must be an object'}), 400

    try:
        models = load_models()
        p, binary_input, type_input, hgb_input, thal_input = build_features(payload)

        binary_prediction = int(models['binary'].predict(binary_input)[0])
        binary_probability = float(np.max(models['binary'].predict_proba(binary_input)[0])) if hasattr(models['binary'], 'predict_proba') else None

        type_prediction = int(models['type'].predict(type_input)[0])
        type_probability = float(np.max(models['type'].predict_proba(type_input)[0])) if hasattr(models['type'], 'predict_proba') else None

        predicted_hgb = round(float(models['hgb'].predict(hgb_input)[0]), 2)
        diagnosis = classify_hb(predicted_hgb)
        urgency = 'HIGH' if predicted_hgb < 9 else 'NORMAL'
        required_units = 2 if predicted_hgb < 9 else 1
        decline_rate = round((p['hemoglobin'] - predicted_hgb) / max(p['avg_cycle_days'], 1), 3)

        thalassaemia_screen = screen_thalassaemia(models['thal'], thal_input)

        return jsonify({
            'modelDriven': True,
            'inputs': {'age': p['age'], 'gender': p['gender'], 'hemoglobin': p['hemoglobin'], 'platelets': p['platelets'], 'ferritin': p['ferritin'], 'mcv': p['mcv'], 'mch': p['mch'], 'mchc': p['mchc']},
            'predictions': {'anemiaBinary': label_for('binary', binary_prediction), 'anemiaBinaryProbability': binary_probability, 'anemiaType': label_for('type', type_prediction), 'anemiaTypeProbability': type_probability, 'predictedHemoglobin': predicted_hgb, 'diagnosis': diagnosis, 'urgency': urgency, 'requiredUnits': required_units, 'expectedCycleDays': p['avg_cycle_days'], 'declineRate': decline_rate, 'thalassaemiaScreen': thalassaemia_screen},
        })
    except ValueError as exc:
        return jsonify({'error': str(exc)}), 400
    except FileNotFoundError as exc:
        return jsonify({'error': f'Model file missing: {exc}'}), 500
    except Exception as exc:
        return jsonify({'error': str(exc)}), 500


@app.route('/api/chat', methods=['POST'])
@require_api_key
def chat():
    data = request.json
    if not isinstance(data, dict) or 'message' not in data:
        return jsonify({'error': 'No message provided.'}), 400

    user_message = str(data['message']).strip()
    if not user_message:
        return jsonify({'error': 'No message provided.'}), 400
    if len(user_message) > 2000:
        return jsonify({'error': 'Message is too long.'}), 400

    client = get_openai_client()
    if client is None:
        return jsonify({'reply': build_fallback_reply(user_message), 'mode': 'fallback'})

    try:
        configured_model = os.environ.get('AI_CHAT_MODEL')
        configured_base_url = os.environ.get('OPENAI_BASE_URL', '')
        api_key = os.environ.get('OPENAI_API_KEY', '')
        chat_model = configured_model or (
            'grok-3' if configured_base_url.startswith('https://api.x.ai') or api_key.startswith('xai-') else 'gpt-4o-mini'
        )
        response = client.chat.completions.create(
            model=chat_model,
            messages=[
                {'role': 'system', 'content': 'You are a helpful medical and administrative assistant for ThalAI Connect, a blood donation platform for thalassemia patients. Keep answers clear, supportive, and concise. Do not provide specific medical diagnoses — always recommend consulting a doctor for medical decisions.'},
                {'role': 'user', 'content': user_message}
            ]
        )
        return jsonify({'reply': response.choices[0].message.content})
    except Exception:
        # Log the real error (was silently swallowed) but still degrade gracefully.
        logger.exception('Chat completion failed; returning fallback reply')
        return jsonify({'reply': build_fallback_reply(user_message), 'mode': 'fallback'})


if __name__ == '__main__':
    PORT = int(os.environ.get('PORT', 5001))
    # Development server only — single-threaded and not for production load.
    # In production run a real WSGI server, e.g.:
    #   gunicorn --workers 2 --threads 4 --timeout 60 --bind 0.0.0.0:$PORT app:app
    logger.warning('Starting Flask DEV server on port %s — use gunicorn in production.', PORT)
    app.run(host='0.0.0.0', port=PORT, debug=False)
