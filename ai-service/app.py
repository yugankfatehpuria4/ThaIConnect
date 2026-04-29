import os
import subprocess
import sys
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from flask import Flask, request, jsonify
from flask_cors import CORS
from openai import OpenAI
from dotenv import load_dotenv

from dotenv import load_dotenv, dotenv_values

ENV_PATH = Path(__file__).resolve().parent / '.env'
load_dotenv(dotenv_path=ENV_PATH, override=True)

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes so the frontend can call it directly

ROOT_DIR = Path(__file__).resolve().parents[1]
ML_DATA_DIR = ROOT_DIR / 'backend' / 'ml-data'
DATASET_SCRIPT = ML_DATA_DIR / 'build_final_patient_dataset.py'

MODEL_FILES = {
    'binary': ML_DATA_DIR / 'xgboost_model.joblib',
    'type': ML_DATA_DIR / 'xgboost_model (2).joblib',
    'hgb': ML_DATA_DIR / 'xgboost_hgb_model.joblib',
}

MODEL_CACHE = {
    'binary': None,
    'type': None,
    'hgb': None,
}

import httpx

def get_openai_client():
    config = dotenv_values(dotenv_path=ENV_PATH)
    api_key = config.get("OPENAI_API_KEY") or os.environ.get("OPENAI_API_KEY")
    if not api_key or api_key == 'your_openai_api_key_here':
        return None

    # Pass a custom httpx.Client to prevent the 'proxies' kwarg TypeError 
    # resulting from mismatched httpx vs openai package versions
    return OpenAI(api_key=api_key, http_client=httpx.Client())


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
        numeric = int(value)
        return 1 if numeric == 1 else 0
    except Exception:
        return 0


def load_models():
    if MODEL_CACHE['binary'] is None:
        MODEL_CACHE['binary'] = joblib.load(MODEL_FILES['binary'])
    if MODEL_CACHE['type'] is None:
        MODEL_CACHE['type'] = joblib.load(MODEL_FILES['type'])
    if MODEL_CACHE['hgb'] is None:
        MODEL_CACHE['hgb'] = joblib.load(MODEL_FILES['hgb'])
    return MODEL_CACHE


def preprocess_payload(payload):
    return {
        'age': float(payload.get('age', 25)),
        'gender': payload.get('gender', 'Female'),
        'hemoglobin': float(payload.get('hemoglobin', 9.2)),
        'platelets': float(payload.get('platelets', 180)),
        'ferritin': float(payload.get('ferritin', 1200)),
        'mcv': float(payload.get('mcv', 82)),
        'mch': float(payload.get('mch', 27)),
        'mchc': float(payload.get('mchc', 32)),
        'wbc': float(payload.get('wbc', 8.5)),
        'lymp': float(payload.get('lymp', 30)),
        'neutp': float(payload.get('neutp', 60)),
        'lymn': float(payload.get('lymn', 2.5)),
        'neutn': float(payload.get('neutn', 5.2)),
        'rbc': float(payload.get('rbc', 4.1)),
        'hct': float(payload.get('hct', 32)),
        'pdw': float(payload.get('pdw', 12.5)),
        'pct': float(payload.get('pct', 0.2)),
        'rdw': float(payload.get('rdw', 13.0)),
        'tlc': float(payload.get('tlc', 7.8)),
        'avg_cycle_days': int(payload.get('avg_cycle_days', 21)),
    }


def build_features(payload):
    p = preprocess_payload(payload)

    binary_input = pd.DataFrame([
        {
            'Gender': normalize_gender(p['gender']),
            'Hemoglobin': p['hemoglobin'],
            'MCH': p['mch'],
            'MCHC': p['mchc'],
            'MCV': p['mcv'],
        }
    ])

    type_input = pd.DataFrame([
        {
            'WBC': p['wbc'],
            'LYMp': p['lymp'],
            'NEUTp': p['neutp'],
            'LYMn': p['lymn'],
            'NEUTn': p['neutn'],
            'RBC': p['rbc'],
            'HGB': p['hemoglobin'],
            'HCT': p['hct'],
            'MCV': p['mcv'],
            'MCH': p['mch'],
            'MCHC': p['mchc'],
            'PLT': p['platelets'],
            'PDW': p['pdw'],
            'PCT': p['pct'],
        }
    ])

    hgb_input = pd.DataFrame([
        {
            'age': p['age'],
            'sex': normalize_gender(p['gender']),
            'rbc': p['rbc'],
            'pcv': p['hct'],
            'mcv': p['mcv'],
            'mch': p['mch'],
            'mchc': p['mchc'],
            'rdw': p['rdw'],
            'tlc': p['tlc'],
            'plt__per_mm3': p['platelets'],
        }
    ])

    return p, binary_input, type_input, hgb_input


def map_type_label(class_id: int) -> str:
    labels = {
        0: 'No Anemia',
        1: 'Microcytic Anemia',
        2: 'Normocytic Anemia',
        3: 'Macrocytic Anemia',
        4: 'Iron Deficiency Pattern',
        5: 'Mixed Pattern',
        6: 'Megaloblastic Pattern',
        7: 'Hemolytic Pattern',
        8: 'Hypochromic Pattern',
    }
    return labels.get(class_id, f'Class-{class_id}')


@app.route('/api/ml/health', methods=['GET'])
def ml_health():
    status = {
        'models': {k: v.exists() for k, v in MODEL_FILES.items()},
        'dataset_builder': DATASET_SCRIPT.exists(),
    }
    return jsonify(status)


@app.route('/api/ml/build-dataset', methods=['POST'])
def build_dataset():
    if not DATASET_SCRIPT.exists():
        return jsonify({'error': f'Dataset script not found at {DATASET_SCRIPT}'}), 404

    try:
        result = subprocess.run(
            [sys.executable, str(DATASET_SCRIPT)],
            cwd=str(ML_DATA_DIR),
            capture_output=True,
            text=True,
            check=True,
        )
        output_file = ML_DATA_DIR / 'final_patient_dataset.csv'
        return jsonify({
            'success': True,
            'stdout': result.stdout,
            'dataset': str(output_file),
            'exists': output_file.exists(),
        })
    except subprocess.CalledProcessError as exc:
        return jsonify({'error': 'Dataset build failed', 'stdout': exc.stdout, 'stderr': exc.stderr}), 500


@app.route('/api/ml/predict', methods=['POST'])
def ml_predict():
    payload = request.json or {}

    try:
        models = load_models()
        p, binary_input, type_input, hgb_input = build_features(payload)

        binary_prediction = int(models['binary'].predict(binary_input)[0])
        binary_probability = None
        if hasattr(models['binary'], 'predict_proba'):
            binary_probability = float(np.max(models['binary'].predict_proba(binary_input)[0]))

        type_prediction = int(models['type'].predict(type_input)[0])
        type_probability = None
        if hasattr(models['type'], 'predict_proba'):
            type_probability = float(np.max(models['type'].predict_proba(type_input)[0]))

        predicted_hgb = float(models['hgb'].predict(hgb_input)[0])
        predicted_hgb = round(predicted_hgb, 2)

        diagnosis = classify_hb(predicted_hgb)
        urgency = 'HIGH' if predicted_hgb < 9 else 'NORMAL'
        required_units = 2 if predicted_hgb < 9 else 1
        decline_rate = round((p['hemoglobin'] - predicted_hgb) / max(p['avg_cycle_days'], 1), 3)

        response = {
            'modelDriven': True,
            'inputs': {
                'age': p['age'],
                'gender': p['gender'],
                'hemoglobin': p['hemoglobin'],
                'platelets': p['platelets'],
                'ferritin': p['ferritin'],
                'mcv': p['mcv'],
                'mch': p['mch'],
                'mchc': p['mchc'],
            },
            'predictions': {
                'anemiaBinary': 'Anemia' if binary_prediction == 1 else 'No Anemia',
                'anemiaBinaryProbability': binary_probability,
                'anemiaType': map_type_label(type_prediction),
                'anemiaTypeProbability': type_probability,
                'predictedHemoglobin': predicted_hgb,
                'diagnosis': diagnosis,
                'urgency': urgency,
                'requiredUnits': required_units,
                'expectedCycleDays': p['avg_cycle_days'],
                'declineRate': decline_rate,
            },
            'coverage': {
                'hemoglobin': 'Dataset 1',
                'platelets': 'Dataset 2',
                'cbc': 'Dataset 2',
                'age': 'Dataset 3',
                'gender': 'Dataset 1 + 3',
                'ferritin': 'Dataset 4',
            },
        }

        return jsonify(response)
    except FileNotFoundError as exc:
        return jsonify({'error': f'Model file missing: {exc}'}), 500
    except Exception as exc:
        return jsonify({'error': str(exc)}), 500

@app.route('/api/chat', methods=['POST'])
def chat():
    fallback_reply = "I'm currently operating in offline mode. I'm ThalAI Connect's assistant! If you need urgent assistance, please check the Dashboard or contact a nearby hospital."

    data = request.json
    if not data or 'message' not in data:
        return jsonify({"error": "No message provided."}), 400

    user_message = data['message']

    client = get_openai_client()
    if client is None:
        # Graceful fallback if no valid key is configured
        return jsonify({"reply": "AI Error: API Key not found or invalid format in .env."})
    
    try:
        response = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": "You are a helpful medical and administrative assistant for ThalAI Connect, an active SOS and blood donation platform. Keep your answers clear, supportive, and concise."},
                {"role": "user", "content": user_message}
            ]
        )
        return jsonify({"reply": response.choices[0].message.content})
    except Exception as e:
        print(f"OpenAI API error: {str(e)}")
        # Return the actual error to the frontend so the user can debug their API key!
        return jsonify({"reply": f"AI Error: {str(e)}"})

if __name__ == '__main__':
    PORT = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=PORT)
