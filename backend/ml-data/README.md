# ThalAI ML Data + Model Integration

## Data coverage mapping
- Hemoglobin: Dataset 1 (`anemia_basic.csv` or fallback `anemia.csv`)
- Platelets: Dataset 2 (`anemia_types.csv` or fallback `diagnosed_cbc_data_v4.csv`)
- CBC (`mcv`, `mch`, `mchc`): Dataset 2
- Age/Gender: Dataset 3 (`clinical_india.csv` or fallback `CBC data_for_meandeley_csv.csv`)
- Ferritin/Iron: Dataset 4 (`anemia_large.csv` or fallback `SKILICARSLAN_Anemia_DataSet.xlsx`)

## Build final ML-ready dataset
From repo root:

```bash
/Users/yugankfatehpuria/Desktop/MINOR/.venv/bin/python \
  /Users/yugankfatehpuria/Desktop/MINOR/ThaiConnect/backend/ml-data/build_final_patient_dataset.py
```

Output:
- `backend/ml-data/final_patient_dataset.csv`

## ML service endpoints (Flask ai-service)
- `GET /api/ml/health`
- `POST /api/ml/build-dataset`
- `POST /api/ml/predict`

The frontend calls backend route:
- `POST /api/patient/predictions/model` (backend proxies to ai-service)

## Notes
- XGBoost on macOS requires `libomp`.
- Installed using: `brew install libomp`
