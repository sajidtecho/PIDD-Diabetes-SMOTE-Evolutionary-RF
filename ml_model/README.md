# Machine Learning Model & Artifacts

This directory contains all research, experiments, training scripts, and serialized model artifacts for the Diabetes Prediction framework.

---

## 📁 Directory Files

- **`Diabetes_Prediction_SMOTE_RandomForest.ipynb`**: Complete exploratory Jupyter Notebook executed in Google Colab containing data preprocessing, SMOTE rebalancing, baseline models, Genetic Algorithm optimization, and evaluation visualizations.
- **`train_and_export.py`**: Standalone production training script that reproduces the optimal 300-estimator Random Forest model with calibrated decision threshold ($\tau = 0.42$) and exports the serialized model payload.
- **`diabetes_model.joblib`**: Serialized production artifact consumed by the FastAPI backend containing:
  - Fitted `RandomForestClassifier` (300 trees)
  - Calibrated decision threshold (`0.42`)
  - Learned median imputation values
  - Feature names and Gini importances
  - Validation benchmark metrics
- **`smote_rf_results.csv`**: Exported evaluation metrics from baseline SMOTE + RF experimentation.

---

## 🔄 Retraining & Updating the Model

To retrain the model and regenerate `diabetes_model.joblib`:

```bash
python ml_model/train_and_export.py
```
