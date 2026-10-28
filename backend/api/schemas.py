from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any

class PatientVitalsInput(BaseModel):
    patient_name: Optional[str] = Field(default="Anonymous Patient", description="Patient identifier or name")
    pregnancies: int = Field(default=0, ge=0, le=20, description="Number of pregnancies")
    glucose: float = Field(default=120.0, ge=0.0, le=350.0, description="Plasma glucose concentration (mg/dL)")
    blood_pressure: float = Field(default=70.0, ge=0.0, le=200.0, description="Diastolic blood pressure (mm Hg)")
    skin_thickness: float = Field(default=20.0, ge=0.0, le=100.0, description="Triceps skin fold thickness (mm)")
    insulin: float = Field(default=80.0, ge=0.0, le=900.0, description="2-Hour serum insulin (mu U/ml)")
    bmi: float = Field(default=25.0, ge=0.0, le=75.0, description="Body mass index (weight in kg/(height in m)^2)")
    pedigree: float = Field(default=0.45, ge=0.0, le=3.0, description="Diabetes pedigree function score")
    age: int = Field(default=35, ge=1, le=120, description="Age in years")

class BiomarkerStatus(BaseModel):
    value: float
    unit: str
    status: str
    benchmark: str

class PredictionResponse(BaseModel):
    patient_name: str
    probability: float
    probability_percentage: float
    is_diabetic: bool
    risk_level: str
    decision_threshold: float
    top_risk_factors: List[str]
    biomarker_analysis: Dict[str, BiomarkerStatus]
    clinical_recommendations: List[str]

class PatientRecord(BaseModel):
    id: str
    patient_name: str
    timestamp: str
    probability: float
    risk_level: str
    is_diabetic: bool
    vitals: Dict[str, Any]

class LoginRequest(BaseModel):
    username: str
    password: str

class LoginResponse(BaseModel):
    token: str
    user: Dict[str, str]

class ModelMetadataResponse(BaseModel):
    model_name: str
    metrics: Dict[str, float]
    feature_importances: Dict[str, float]
    decision_threshold: float
