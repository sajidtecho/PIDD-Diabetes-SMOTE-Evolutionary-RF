import os
import uuid
from datetime import datetime
import joblib
import numpy as np
from fastapi import APIRouter, HTTPException
from .schemas import (
    PatientVitalsInput,
    PredictionResponse,
    BiomarkerStatus,
    PatientRecord,
    LoginRequest,
    LoginResponse,
    ModelMetadataResponse
)

router = APIRouter()

# Load model artifact
MODEL_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "model", "diabetes_model.joblib")

if not os.path.exists(MODEL_PATH):
    raise RuntimeError(f"Model artifact not found at {MODEL_PATH}. Run train_and_export.py first.")

payload = joblib.load(MODEL_PATH)
model = payload["model"]
threshold = float(payload.get("threshold", 0.42))
medians = payload.get("medians", {})
features = payload.get("features", [])
feature_importances = payload.get("feature_importances", {})
metrics = payload.get("metrics", {})
model_name = payload.get("model_name", "Random Forest + SMOTE")

# Persistent EHR records store in-memory with pre-loaded demo patients
ehr_records_db = [
    {
        "id": "REC-94821",
        "patient_name": "Eleanor Vance",
        "timestamp": "2026-10-28 14:32",
        "probability": 0.74,
        "risk_level": "High Risk",
        "is_diabetic": True,
        "vitals": {"pregnancies": 3, "glucose": 158.0, "blood_pressure": 82.0, "skin_thickness": 32.0, "insulin": 190.0, "bmi": 34.2, "pedigree": 0.68, "age": 52}
    },
    {
        "id": "REC-81729",
        "patient_name": "Marcus Chen",
        "timestamp": "2026-10-28 11:15",
        "probability": 0.18,
        "risk_level": "Low Risk",
        "is_diabetic": False,
        "vitals": {"pregnancies": 0, "glucose": 92.0, "blood_pressure": 68.0, "skin_thickness": 18.0, "insulin": 75.0, "bmi": 22.8, "pedigree": 0.22, "age": 29}
    },
    {
        "id": "REC-73910",
        "patient_name": "Sophia Morales",
        "timestamp": "2026-10-27 16:45",
        "probability": 0.38,
        "risk_level": "Moderate Risk",
        "is_diabetic": False,
        "vitals": {"pregnancies": 1, "glucose": 118.0, "blood_pressure": 76.0, "skin_thickness": 24.0, "insulin": 110.0, "bmi": 28.1, "pedigree": 0.41, "age": 41}
    }
]

def analyze_biomarkers(vitals: PatientVitalsInput):
    # Glucose
    if vitals.glucose < 100:
        gluc_status = "Optimal"
    elif 100 <= vitals.glucose <= 125:
        gluc_status = "Impaired (Pre-diabetic)"
    else:
        gluc_status = "Elevated (Diabetic Range)"

    # BMI
    if vitals.bmi < 18.5:
        bmi_status = "Underweight"
    elif 18.5 <= vitals.bmi <= 24.9:
        bmi_status = "Normal Weight"
    elif 25.0 <= vitals.bmi <= 29.9:
        bmi_status = "Overweight"
    else:
        bmi_status = "Obese (Class I/II)"

    # Blood Pressure
    if vitals.blood_pressure < 80:
        bp_status = "Optimal Diastolic"
    elif 80 <= vitals.blood_pressure <= 89:
        bp_status = "Prehypertensive"
    else:
        bp_status = "Elevated Blood Pressure"

    # Insulin
    if vitals.insulin < 16:
        ins_status = "Low Basal"
    elif 16 <= vitals.insulin <= 166:
        ins_status = "Normal Range"
    else:
        ins_status = "Hyperinsulinemia (Resistance)"

    return {
        "Glucose": BiomarkerStatus(value=vitals.glucose, unit="mg/dL", status=gluc_status, benchmark="< 100 mg/dL Normal"),
        "BMI": BiomarkerStatus(value=vitals.bmi, unit="kg/m²", status=bmi_status, benchmark="18.5 – 24.9 kg/m² Normal"),
        "BloodPressure": BiomarkerStatus(value=vitals.blood_pressure, unit="mm Hg", status=bp_status, benchmark="< 80 mm Hg Diastolic"),
        "Insulin": BiomarkerStatus(value=vitals.insulin, unit="μU/mL", status=ins_status, benchmark="16 – 166 μU/mL Normal"),
    }

def generate_recommendations(prob: float, vitals: PatientVitalsInput):
    recs = []
    if vitals.glucose >= 126:
        recs.append("Immediate follow-up: Schedule laboratory fasting plasma glucose (FPG) and HbA1c confirmatory testing.")
    elif vitals.glucose >= 100:
        recs.append("Glycaemic Control: Implement medical nutritional therapy reducing refined carbohydrates and sugar-sweetened beverages.")

    if vitals.bmi >= 30:
        recs.append("Weight Management: Target 5–10% baseline weight reduction through caloric deficit and structured aerobic exercise.")
    elif vitals.bmi >= 25:
        recs.append("Lifestyle Optimization: Minimum 150 minutes per week of moderate-intensity physical activity (e.g., brisk walking).")

    if vitals.blood_pressure >= 90:
        recs.append("Cardiovascular Monitoring: Diastolic hypertension detected; recommend 24-hour ambulatory BP monitoring and sodium restriction.")

    if vitals.pedigree >= 0.6:
        recs.append("Family Risk Surveillance: High hereditary predisposition identified; recommend annual metabolic profiling.")

    if not recs:
        recs.append("Maintain routine annual wellness screening; metabolic and vital sign markers are within optimal ranges.")

    return recs

@router.post("/predict", response_model=PredictionResponse)
def predict_diabetes(vitals: PatientVitalsInput):
    # Impute missing/zero clinical signals using learned medians
    g = vitals.glucose if vitals.glucose > 0 else medians.get("Glucose", 117.0)
    bp = vitals.blood_pressure if vitals.blood_pressure > 0 else medians.get("BloodPressure", 72.0)
    st = vitals.skin_thickness if vitals.skin_thickness > 0 else medians.get("SkinThickness", 29.0)
    ins = vitals.insulin if vitals.insulin > 0 else medians.get("Insulin", 125.0)
    bmi_val = vitals.bmi if vitals.bmi > 0 else medians.get("BMI", 32.3)

    raw_features = [
        vitals.pregnancies,
        g,
        bp,
        st,
        ins,
        bmi_val,
        vitals.pedigree,
        vitals.age
    ]

    arr = np.array([raw_features], dtype=np.float32)
    prob = float(model.predict_proba(arr)[0, 1])
    is_diabetic = bool(prob >= threshold)

    if prob < 0.30:
        risk_level = "Low Risk"
    elif 0.30 <= prob < threshold:
        risk_level = "Moderate / Borderline Risk"
    else:
        risk_level = "High Clinical Risk"

    # Identify primary contributing factors
    contributors = []
    if g >= 126:
        contributors.append(f"Hyperglycaemia (Glucose: {g:.1f} mg/dL)")
    elif g >= 100:
        contributors.append(f"Impaired Glucose (Glucose: {g:.1f} mg/dL)")

    if bmi_val >= 30:
        contributors.append(f"Clinical Obesity (BMI: {bmi_val:.1f} kg/m²)")
    elif bmi_val >= 25:
        contributors.append(f"Overweight Factor (BMI: {bmi_val:.1f} kg/m²)")

    if vitals.age >= 45:
        contributors.append(f"Age Risk Factor ({vitals.age} years)")

    if vitals.pedigree >= 0.6:
        contributors.append(f"Genetic Predisposition Score ({vitals.pedigree:.2f})")

    if not contributors:
        contributors.append("Baseline biomarkers stable within physiological limits")

    biomarkers = analyze_biomarkers(vitals)
    recommendations = generate_recommendations(prob, vitals)

    return PredictionResponse(
        patient_name=vitals.patient_name,
        probability=round(prob, 4),
        probability_percentage=round(prob * 100, 2),
        is_diabetic=is_diabetic,
        risk_level=risk_level,
        decision_threshold=threshold,
        top_risk_factors=contributors,
        biomarker_analysis=biomarkers,
        clinical_recommendations=recommendations
    )

@router.get("/records", response_model=list[PatientRecord])
def get_all_ehr_records():
    return ehr_records_db

@router.post("/records", response_model=PatientRecord)
def save_ehr_record(record_data: dict):
    rec_id = f"REC-{uuid.uuid4().hex[:5].upper()}"
    new_record = {
        "id": rec_id,
        "patient_name": record_data.get("patient_name", "Anonymous"),
        "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M"),
        "probability": float(record_data.get("probability", 0.0)),
        "risk_level": record_data.get("risk_level", "Unknown"),
        "is_diabetic": bool(record_data.get("is_diabetic", False)),
        "vitals": record_data.get("vitals", {})
    }
    ehr_records_db.insert(0, new_record)
    return new_record

@router.delete("/records/{record_id}")
def delete_ehr_record(record_id: str):
    global ehr_records_db
    before_len = len(ehr_records_db)
    ehr_records_db = [r for r in ehr_records_db if r["id"] != record_id]
    if len(ehr_records_db) == before_len:
        raise HTTPException(status_code=404, detail="Record not found")
    return {"status": "success", "message": f"Record {record_id} removed"}

@router.get("/model-info", response_model=ModelMetadataResponse)
def get_model_metadata():
    return ModelMetadataResponse(
        model_name=model_name,
        metrics=metrics,
        feature_importances=feature_importances,
        decision_threshold=threshold
    )

@router.post("/auth/login", response_model=LoginResponse)
def clinician_login(creds: LoginRequest):
    # Simulated clinician authentication for demonstration
    return LoginResponse(
        token=f"jwt_token_{uuid.uuid4().hex}",
        user={
            "name": creds.username.capitalize() if creds.username else "Dr. Alex Taylor",
            "role": "Lead Endocrinologist",
            "hospital": "Metro Clinical Health System",
            "badge_id": "MED-78921"
        }
    )
