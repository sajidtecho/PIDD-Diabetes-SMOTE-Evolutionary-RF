import os
import joblib
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, recall_score, precision_score, f1_score, roc_auc_score
from imblearn.over_sampling import SMOTE

DATA_URL = "https://raw.githubusercontent.com/plotly/datasets/master/diabetes.csv"
FEATURES = ["Pregnancies", "Glucose", "BloodPressure", "SkinThickness", "Insulin", "BMI", "DiabetesPedigreeFunction", "Age"]
TARGET = "Outcome"
RANDOM_STATE = 16

print("1. Loading PIDD dataset...")
try:
    df = pd.read_csv(DATA_URL)
    print("Loaded from URL.")
except Exception as e:
    print(f"Fallback to local CSV due to: {e}")
    df = pd.read_csv("diabetes.csv")

zero_cols = ["Glucose", "BloodPressure", "SkinThickness", "Insulin", "BMI"]
df_clean = df.copy()
df_clean[zero_cols] = df_clean[zero_cols].replace(0, np.nan)

# Compute median imputation values from full set
medians = df_clean[zero_cols].median().to_dict()
print("Computed imputation medians:", medians)

# Fill NaNs with medians
df_clean[zero_cols] = df_clean[zero_cols].fillna(pd.Series(medians))

X = df_clean[FEATURES].values
y = df_clean[TARGET].values

# Stratified 80/20 train/test split
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.20, stratify=y, random_state=RANDOM_STATE
)

# Apply SMOTE to training set
print("2. Applying SMOTE to training set...")
sm = SMOTE(random_state=RANDOM_STATE)
X_train_res, y_train_res = sm.fit_resample(X_train, y_train)

# Optimal GA Hyperparameters
print("3. Fitting Random Forest model (300 estimators)...")
clf = RandomForestClassifier(
    n_estimators=300,
    max_depth=25,
    min_samples_split=5,
    min_samples_leaf=4,
    random_state=RANDOM_STATE,
    n_jobs=-1
)
clf.fit(X_train_res, y_train_res)

# Evaluate on test set with optimal threshold 0.42
y_proba = clf.predict_proba(X_test)[:, 1]
OPTIMAL_THRESHOLD = 0.42
y_pred = (y_proba >= OPTIMAL_THRESHOLD).astype(int)

metrics = {
    "Accuracy": float(accuracy_score(y_test, y_pred)),
    "Sensitivity": float(recall_score(y_test, y_pred)),
    "Precision": float(precision_score(y_test, y_pred, zero_division=0)),
    "F1": float(f1_score(y_test, y_pred)),
    "ROC_AUC": float(roc_auc_score(y_test, y_proba)),
}

print("=== Model Test Evaluation ===")
for k, v in metrics.items():
    print(f"{k:12s}: {v*100:.2f}%")

feature_importances = {feat: float(imp) for feat, imp in zip(FEATURES, clf.feature_importances_)}

# Save model payload
output_dir = os.path.dirname(os.path.abspath(__file__))
model_path = os.path.join(output_dir, "diabetes_model.joblib")

payload = {
    "model": clf,
    "threshold": OPTIMAL_THRESHOLD,
    "medians": medians,
    "features": FEATURES,
    "feature_importances": feature_importances,
    "metrics": metrics,
    "model_name": "SMOTE + Genetic Algorithm Optimized Random Forest"
}

joblib.dump(payload, model_path)
print(f"Artifact successfully saved to {model_path}")
