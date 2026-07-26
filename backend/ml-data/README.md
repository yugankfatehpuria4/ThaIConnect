# ThalAI ML Data + Model Integration

## Models (trained by `train_models.py`)
| key    | file                    | task                              | source dataset                     |
|--------|-------------------------|-----------------------------------|------------------------------------|
| binary | `anemia_binary.joblib`  | anemia yes/no                     | `anemia.csv`                       |
| type   | `anemia_type.joblib`    | anemia subtype (9-way)            | `diagnosed_cbc_data_v4.csv`        |
| hgb    | `hgb_regressor.joblib`  | predict hemoglobin from CBC       | `CBC data_for_meandeley_csv.csv`   |
| thal   | `thal_screener.joblib`  | thalassaemia screen from CBC (NEW)| `hplc_thalassemia.csv` (13k rows)  |

`model_metadata.json` is the **single source of truth** for each model's feature
order, class labels, and (for the screener) the decision threshold. The Flask
ai-service reads labels from it, so prediction names always match the trained
models. Do not hand-edit it — re-run the trainer.

## Retrain
Use the ai-service venv so saved models load in production (xgboost versions match):

```bash
ThaiConnect/ai-service/venv/bin/python ThaiConnect/backend/ml-data/train_models.py
```

Old pre-trained models are preserved under `_legacy_models_backup/`.

## Thalassaemia screener notes
- CBC-only features: `age, sex, rbc, hemoglobin, mcv, mch, mchc, rdw` — the same
  values the prediction payload already carries, so no new input is required.
- Flags when `P(abnormal) >= screening_threshold` (0.20), tuned for sensitivity:
  ~0.80 sensitivity / 0.81 specificity on held-out data.
- A flag means **"refer for confirmatory HPLC / Hb electrophoresis"**, not a
  diagnosis. HbA2/HbF confirmation still requires an actual HPLC run.

## Reference dataset builder
`build_final_patient_dataset.py` → `final_patient_dataset.csv` (demo patient
table; unrelated to model training). Ferritin is sourced only from the real
`FERRITTE` column — serum iron is a different test and is never relabelled.

## Other datasets in this folder (for the donor-matching model, not predictions)
- `blood_donor_directory.csv` — donor directory (10k rows)
- `donor_transfusion_rfmtc.csv`, `donor_donation_train.csv` — donor-response history
- `alpha_thalassemia/` — genotyped alpha-thalassaemia research data (Thai cohort)

## Endpoints (Flask ai-service)
- `GET  /api/ml/health`   — reports which model files exist
- `POST /api/ml/predict`  — returns anemia + hemoglobin + `thalassaemiaScreen`
- `POST /api/ml/build-dataset`

The frontend calls the backend route `POST /api/patient/predictions/model`,
which proxies to the ai-service.

## Environment
- XGBoost on macOS requires `libomp` (`brew install libomp`).
