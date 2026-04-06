from __future__ import annotations

import random
from pathlib import Path

import pandas as pd

BASE_DIR = Path(__file__).resolve().parent


def resolve_file(*candidates: str) -> Path:
    for candidate in candidates:
        candidate_path = BASE_DIR / candidate
        if candidate_path.exists():
            return candidate_path
    raise FileNotFoundError(f"None of these files exist in {BASE_DIR}: {candidates}")


def load_table(path: Path) -> pd.DataFrame:
    if path.suffix.lower() == ".xlsx":
        return pd.read_excel(path)
    return pd.read_csv(path)


def to_numeric_series(series: pd.Series) -> pd.Series:
    return pd.to_numeric(series, errors="coerce")


def clean_columns(df: pd.DataFrame) -> pd.DataFrame:
    df.columns = [str(column).strip() for column in df.columns]
    return df


def classify(hb: float) -> str:
    if hb < 8:
        return "Severe"
    if hb < 10:
        return "Moderate"
    return "Mild"


def generate_history(hb: float) -> list[float]:
    history: list[float] = []
    current = hb
    for _ in range(5):
        current = current - random.uniform(0.2, 0.6)
        history.append(round(current, 1))
    return history


def main() -> None:
    random.seed(42)

    dataset_1_path = resolve_file("anemia_basic.csv", "anemia.csv")
    dataset_2_path = resolve_file("anemia_types.csv", "diagnosed_cbc_data_v4.csv")
    dataset_3_path = resolve_file("clinical_india.csv", "CBC data_for_meandeley_csv.csv")
    dataset_4_path = resolve_file("anemia_large.csv", "SKILICARSLAN_Anemia_DataSet.xlsx")

    df1 = clean_columns(load_table(dataset_1_path))
    df2 = clean_columns(load_table(dataset_2_path))
    df3 = clean_columns(load_table(dataset_3_path))
    df4 = clean_columns(load_table(dataset_4_path))

    df1.rename(columns={
        "Gender": "gender",
        "GENDER": "gender",
        "Hb": "hemoglobin",
        "HGB": "hemoglobin",
        "Hemoglobin": "hemoglobin",
    }, inplace=True)

    df2.rename(columns={
        "HGB": "hemoglobin",
        "Hemoglobin": "hemoglobin",
        "PLT": "platelets",
        "PLT /mm3": "platelets",
        "MCV": "MCV",
        "MCH": "MCH",
        "MCHC": "MCHC",
    }, inplace=True)

    df3.rename(columns={
        "Age": "age",
        "Age      ": "age",
        "Gender": "gender",
        "Sex": "gender",
        "Sex  ": "gender",
    }, inplace=True)

    df4.rename(columns={
        "Serum_Iron": "ferritin",
        "FERRITTE": "ferritin",
    }, inplace=True)

    for column in ["gender", "hemoglobin"]:
        if column not in df1.columns:
            df1[column] = pd.NA
    df1 = df1[["gender", "hemoglobin"]]

    for column in ["hemoglobin", "platelets", "MCV", "MCH", "MCHC"]:
        if column not in df2.columns:
            df2[column] = pd.NA
    df2 = df2[["hemoglobin", "platelets", "MCV", "MCH", "MCHC"]]

    if "age" not in df3.columns:
        df3["age"] = pd.NA
    if "gender" not in df3.columns:
        df3["gender"] = pd.NA
    df3 = df3[["age", "gender"]]

    if "ferritin" not in df4.columns:
        df4["ferritin"] = pd.NA
    df4 = df4[["ferritin"]]

    df2.rename(columns={
        "MCV": "mcv",
        "MCH": "mch",
        "MCHC": "mchc",
    }, inplace=True)

    df = pd.concat([df1, df2], ignore_index=True)

    sampled_age = df3["age"].dropna()
    sampled_ferritin = df4["ferritin"].dropna()

    if sampled_age.empty:
        sampled_age = pd.Series([25, 30, 22, 35])
    if sampled_ferritin.empty:
        sampled_ferritin = pd.Series([900, 1100, 700, 1300])

    df["age"] = sampled_age.sample(len(df), replace=True, random_state=42).values
    df["ferritin"] = sampled_ferritin.sample(len(df), replace=True, random_state=42).values

    df["gender"] = df["gender"].replace({"Male": "Male", "Female": "Female", 1: "Male", 0: "Female"})
    df["gender"] = df["gender"].fillna("Unknown")

    for numeric_column in ["hemoglobin", "platelets", "mcv", "mch", "mchc", "age", "ferritin"]:
        df[numeric_column] = to_numeric_series(df[numeric_column])

    df.ffill(inplace=True)
    df.dropna(inplace=True)

    df["diagnosis"] = df["hemoglobin"].apply(classify)
    df["patientId"] = [f"P{i + 1:04d}" for i in range(len(df))]
    df["hb_history"] = df["hemoglobin"].apply(generate_history)

    final_df = df[[
        "patientId",
        "age",
        "gender",
        "hemoglobin",
        "platelets",
        "ferritin",
        "mcv",
        "mch",
        "mchc",
        "diagnosis",
        "hb_history",
    ]].copy()

    output_path = BASE_DIR / "final_patient_dataset.csv"
    final_df.to_csv(output_path, index=False)
    print(f"Saved {len(final_df)} rows to {output_path}")


if __name__ == "__main__":
    main()
