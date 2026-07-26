"""
Reproducible training pipeline for the ThalAI ML prediction service.

Trains four models from the real clinical datasets in this directory and writes
a single `model_metadata.json` that the Flask ai-service reads as the source of
truth for feature order and class labels.

Models
------
1. anemia_binary   : anemia yes/no          <- anemia.csv
2. anemia_type     : anemia subtype (9-way)  <- diagnosed_cbc_data_v4.csv
3. hgb_regressor   : hemoglobin from CBC      <- CBC data_for_meandeley_csv.csv
4. thal_screener   : thalassaemia screen      <- hplc_thalassemia.csv  (NEW)

Run (use the ai-service venv so the saved models load in production):
    ThaiConnect/ai-service/venv/bin/python \
        ThaiConnect/backend/ml-data/train_models.py
"""
from __future__ import annotations

import json
import re
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.metrics import accuracy_score, mean_absolute_error, r2_score
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
from sklearn.utils.class_weight import compute_sample_weight
from xgboost import XGBClassifier, XGBRegressor

BASE_DIR = Path(__file__).resolve().parent
RANDOM_STATE = 42

metadata: dict = {"models": {}}


def clean_columns(df: pd.DataFrame) -> pd.DataFrame:
    df.columns = [str(c).strip() for c in df.columns]
    return df


def save(model, name: str) -> None:
    import joblib

    out = BASE_DIR / f"{name}.joblib"
    joblib.dump(model, out)
    print(f"  saved -> {out.name}")


# ─────────────────────────────────────────────────────────────────────────────
# 1. Binary anemia classifier  (Gender, Hemoglobin, MCH, MCHC, MCV -> Result)
# ─────────────────────────────────────────────────────────────────────────────
def train_binary() -> None:
    print("\n[1/4] anemia_binary  <- anemia.csv")
    df = clean_columns(pd.read_csv(BASE_DIR / "anemia.csv"))
    features = ["Gender", "Hemoglobin", "MCH", "MCHC", "MCV"]
    X = df[features].apply(pd.to_numeric, errors="coerce")
    y = pd.to_numeric(df["Result"], errors="coerce")
    ok = X.notna().all(axis=1) & y.notna()
    X, y = X[ok], y[ok].astype(int)

    X_tr, X_te, y_tr, y_te = train_test_split(
        X, y, test_size=0.2, random_state=RANDOM_STATE, stratify=y
    )
    model = XGBClassifier(
        n_estimators=300, max_depth=4, learning_rate=0.1,
        subsample=0.9, colsample_bytree=0.9,
        eval_metric="logloss", random_state=RANDOM_STATE,
    )
    model.fit(X_tr, y_tr)
    acc = accuracy_score(y_te, model.predict(X_te))
    print(f"  rows={len(X)}  test_accuracy={acc:.3f}")
    save(model, "anemia_binary")
    metadata["models"]["binary"] = {
        "file": "anemia_binary.joblib",
        "features": features,
        "labels": {"0": "No Anemia", "1": "Anemia"},
        "test_accuracy": round(float(acc), 4),
        "n_rows": int(len(X)),
    }


# ─────────────────────────────────────────────────────────────────────────────
# 2. Anemia-type classifier (14 CBC features -> diagnosis).  Labels come from the
#    data itself, fixing the hard-coded mislabelling in the old app.py.
# ─────────────────────────────────────────────────────────────────────────────
def train_type() -> None:
    print("\n[2/4] anemia_type  <- diagnosed_cbc_data_v4.csv")
    df = clean_columns(pd.read_csv(BASE_DIR / "diagnosed_cbc_data_v4.csv"))
    features = ["WBC", "LYMp", "NEUTp", "LYMn", "NEUTn", "RBC", "HGB",
                "HCT", "MCV", "MCH", "MCHC", "PLT", "PDW", "PCT"]
    X = df[features].apply(pd.to_numeric, errors="coerce")
    y_raw = df["Diagnosis"].astype(str).str.strip()
    ok = X.notna().all(axis=1) & y_raw.notna()
    X, y_raw = X[ok], y_raw[ok]

    le = LabelEncoder()
    y = le.fit_transform(y_raw)

    X_tr, X_te, y_tr, y_te = train_test_split(
        X, y, test_size=0.2, random_state=RANDOM_STATE, stratify=y
    )
    model = XGBClassifier(
        n_estimators=400, max_depth=5, learning_rate=0.1,
        subsample=0.9, colsample_bytree=0.9,
        eval_metric="mlogloss", random_state=RANDOM_STATE,
    )
    model.fit(X_tr, y_tr)
    acc = accuracy_score(y_te, model.predict(X_te))
    print(f"  rows={len(X)}  classes={len(le.classes_)}  test_accuracy={acc:.3f}")
    save(model, "anemia_type")
    metadata["models"]["type"] = {
        "file": "anemia_type.joblib",
        "features": features,
        "labels": {str(i): lbl for i, lbl in enumerate(le.classes_)},
        "test_accuracy": round(float(acc), 4),
        "n_rows": int(len(X)),
    }


# ─────────────────────────────────────────────────────────────────────────────
# 3. Hemoglobin regressor  (age, sex, rbc, pcv, mcv, mch, mchc, rdw, tlc, plt)
# ─────────────────────────────────────────────────────────────────────────────
def train_hgb() -> None:
    print("\n[3/4] hgb_regressor  <- CBC data_for_meandeley_csv.csv")
    df = clean_columns(pd.read_csv(BASE_DIR / "CBC data_for_meandeley_csv.csv"))
    # Column names are messy in the source; map by stripped/normalised name.
    rename = {
        "Age": "age", "Sex": "sex", "RBC": "rbc", "PCV": "pcv", "MCV": "mcv",
        "MCH": "mch", "MCHC": "mchc", "RDW": "rdw", "TLC": "tlc",
        "PLT /mm3": "plt__per_mm3", "HGB": "hemoglobin",
    }
    df = df.rename(columns={c: rename.get(c, c) for c in df.columns})
    features = ["age", "sex", "rbc", "pcv", "mcv", "mch", "mchc", "rdw", "tlc", "plt__per_mm3"]
    keep = features + ["hemoglobin"]
    df = df[[c for c in keep if c in df.columns]].apply(pd.to_numeric, errors="coerce")
    df = df.dropna(subset=features + ["hemoglobin"])

    X, y = df[features], df["hemoglobin"]
    X_tr, X_te, y_tr, y_te = train_test_split(
        X, y, test_size=0.2, random_state=RANDOM_STATE
    )
    model = XGBRegressor(
        n_estimators=400, max_depth=4, learning_rate=0.08,
        subsample=0.9, colsample_bytree=0.9, random_state=RANDOM_STATE,
    )
    model.fit(X_tr, y_tr)
    pred = model.predict(X_te)
    r2 = r2_score(y_te, pred)
    mae = mean_absolute_error(y_te, pred)
    print(f"  rows={len(X)}  test_r2={r2:.3f}  test_mae={mae:.3f} g/dL")
    save(model, "hgb_regressor")
    metadata["models"]["hgb"] = {
        "file": "hgb_regressor.joblib",
        "features": features,
        "target": "hemoglobin",
        "test_r2": round(float(r2), 4),
        "test_mae": round(float(mae), 4),
        "n_rows": int(len(X)),
    }


# ─────────────────────────────────────────────────────────────────────────────
# 4. Thalassaemia screener (NEW)  — predicts hemoglobinopathy risk from a routine
#    CBC, so it slots into the existing prediction payload. Trained on 13k real
#    HPLC-confirmed diagnoses from an Indian population.
# ─────────────────────────────────────────────────────────────────────────────
def parse_age_years(value) -> float:
    """'14 Yrs 11 month' -> 14.9 ; '16 Yrs 0 month' -> 16.0 ; '35' -> 35.0"""
    s = str(value).lower()
    yrs = re.search(r"(\d+)\s*yr", s)
    mon = re.search(r"(\d+)\s*month", s)
    if yrs:
        years = float(yrs.group(1)) + (float(mon.group(1)) / 12.0 if mon else 0.0)
        return round(years, 2)
    num = re.search(r"(\d+(?:\.\d+)?)", s)
    return float(num.group(1)) if num else np.nan


def group_diagnosis(dx: str) -> str:
    d = str(dx).strip().lower()
    if d == "normal":
        return "Normal"
    if "beta thal" in d:                      # carrier, major, HbE-Beta, HbS-Beta
        return "Beta Thalassaemia"
    if "hbe" in d:                            # HbE carrier / disease
        return "HbE"
    return "Other Variant"                    # HbS, HbD, HPFH, delta-beta, etc.


def train_thal() -> None:
    print("\n[4/4] thal_screener  <- hplc_thalassemia.csv  (NEW)")
    df = clean_columns(pd.read_csv(BASE_DIR / "hplc_thalassemia.csv"))

    work = pd.DataFrame()
    work["age"] = df["Age"].apply(parse_age_years)
    work["sex"] = df["Gender"].astype(str).str.strip().str.lower().map(
        {"male": 1, "m": 1, "female": 0, "f": 0}
    )
    work["rbc"] = pd.to_numeric(df["RBC"], errors="coerce")
    work["hemoglobin"] = pd.to_numeric(df["HB"], errors="coerce")
    work["mcv"] = pd.to_numeric(df["MCV"], errors="coerce")
    work["mch"] = pd.to_numeric(df["MCH"], errors="coerce")
    work["mchc"] = pd.to_numeric(df["MCHC"], errors="coerce")
    work["rdw"] = pd.to_numeric(df["RDWcv"], errors="coerce")
    work["label"] = df["Diagnosis"].apply(group_diagnosis)

    features = ["age", "sex", "rbc", "hemoglobin", "mcv", "mch", "mchc", "rdw"]
    work = work.dropna(subset=features + ["label"])

    le = LabelEncoder()
    y = le.fit_transform(work["label"])
    X = work[features]

    X_tr, X_te, y_tr, y_te = train_test_split(
        X, y, test_size=0.2, random_state=RANDOM_STATE, stratify=y
    )
    # Heavy class imbalance (Normal ~90%): weight samples so minority
    # hemoglobinopathies are actually learned.
    sample_weight = compute_sample_weight("balanced", y_tr)
    model = XGBClassifier(
        n_estimators=500, max_depth=5, learning_rate=0.08,
        subsample=0.9, colsample_bytree=0.9,
        eval_metric="mlogloss", random_state=RANDOM_STATE,
    )
    model.fit(X_tr, y_tr, sample_weight=sample_weight)

    pred = model.predict(X_te)
    acc = accuracy_score(y_te, pred)

    # A screening tool is judged on sensitivity to "any abnormal", not raw
    # accuracy. Flag on P(abnormal) = 1 - P(Normal) and pick the lowest
    # threshold that still keeps specificity >= 0.80 (limits over-referral).
    normal_id = int(np.where(le.classes_ == "Normal")[0][0])
    p_abnormal = 1.0 - model.predict_proba(X_te)[:, normal_id]
    abn_true = (y_te != normal_id)

    screening_threshold, sensitivity, specificity = 0.5, 0.0, 0.0
    for t in np.arange(0.15, 0.55, 0.05):
        flag = p_abnormal >= t
        spec = float((~flag & ~abn_true).sum() / max((~abn_true).sum(), 1))
        if spec >= 0.80:
            screening_threshold = round(float(t), 2)
            sensitivity = float((flag & abn_true).sum() / max(abn_true.sum(), 1))
            specificity = spec
            break

    print(f"  rows={len(X)}  classes={list(le.classes_)}")
    print(f"  test_accuracy={acc:.3f}  argmax_abnormal_recall="
          f"{(pred != normal_id)[abn_true].mean():.3f}")
    print(f"  screening@P>={screening_threshold}: sensitivity={sensitivity:.3f} "
          f"specificity={specificity:.3f}")
    save(model, "thal_screener")
    metadata["models"]["thal"] = {
        "file": "thal_screener.joblib",
        "features": features,
        "labels": {str(i): lbl for i, lbl in enumerate(le.classes_)},
        "normal_label": "Normal",
        "screening_threshold": screening_threshold,
        "test_accuracy": round(float(acc), 4),
        "screening_sensitivity": round(sensitivity, 4),
        "screening_specificity": round(specificity, 4),
        "n_rows": int(len(X)),
        "note": "CBC-only thalassaemia/hemoglobinopathy screen. Flag when "
                "P(abnormal) >= screening_threshold. A flag means 'refer for "
                "confirmatory HPLC', NOT a diagnosis.",
    }


def main() -> None:
    print("Training ThalAI models from real clinical datasets...")
    train_binary()
    train_type()
    train_hgb()
    train_thal()

    out = BASE_DIR / "model_metadata.json"
    out.write_text(json.dumps(metadata, indent=2))
    print(f"\nWrote {out.name}")
    print("Done.")


if __name__ == "__main__":
    main()
