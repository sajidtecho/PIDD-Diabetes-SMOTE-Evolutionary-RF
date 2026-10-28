import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  Heart, 
  ShieldCheck, 
  FileText, 
  Database, 
  BarChart3, 
  UserCheck, 
  AlertTriangle, 
  CheckCircle2, 
  Save, 
  RotateCcw, 
  Sliders, 
  Info, 
  Stethoscope,
  Trash2,
  ExternalLink
} from 'lucide-react';

const PRESETS = [
  {
    name: "Healthy Profile",
    data: { patient_name: "James Wilson", pregnancies: 0, glucose: 88, blood_pressure: 68, skin_thickness: 18, insulin: 65, bmi: 22.5, pedigree: 0.21, age: 28 }
  },
  {
    name: "Pre-Diabetic Impaired",
    data: { patient_name: "Rachel Green", pregnancies: 1, glucose: 118, blood_pressure: 78, skin_thickness: 25, insulin: 115, bmi: 28.2, pedigree: 0.42, age: 43 }
  },
  {
    name: "High-Risk Clinical",
    data: { patient_name: "David Miller", pregnancies: 4, glucose: 168, blood_pressure: 88, skin_thickness: 34, insulin: 210, bmi: 35.8, pedigree: 0.82, age: 56 }
  },
  {
    name: "Gestational Risk",
    data: { patient_name: "Maria Santos", pregnancies: 3, glucose: 132, blood_pressure: 74, skin_thickness: 28, insulin: 135, bmi: 31.2, pedigree: 0.65, age: 34 }
  }
];

export default function App() {
  const [activeTab, setActiveTab] = useState('predict');
  const [vitals, setVitals] = useState(PRESETS[1].data);
  const [prediction, setPrediction] = useState(null);
  const [loading, setLoading] = useState(false);
  const [ehrRecords, setEhrRecords] = useState([]);
  const [modelInfo, setModelInfo] = useState(null);
  const [clinician, setClinician] = useState({ name: "Dr. Sarah Jenkins", role: "Chief Endocrinologist", hospital: "Metropolitan Medical Institute" });
  const [saveStatus, setSaveStatus] = useState("");

  const handleInputChange = (field, val) => {
    setVitals(prev => ({
      ...prev,
      [field]: field === 'patient_name' ? val : (parseFloat(val) || 0)
    }));
  };

  const applyPreset = (presetData) => {
    setVitals({ ...presetData });
    setPrediction(null);
  };

  const runPrediction = async () => {
    setLoading(true);
    setSaveStatus("");
    try {
      const res = await fetch('/api/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(vitals)
      });
      if (!res.ok) throw new Error("Inference failed");
      const data = await res.json();
      setPrediction(data);
    } catch (err) {
      console.error(err);
      // Fallback local computation if API is disconnected during standalone preview
      const fallbackProb = Math.min(0.95, Math.max(0.05, (vitals.glucose - 70) / 130 * 0.5 + (vitals.bmi - 20) / 25 * 0.35 + (vitals.age - 20) / 60 * 0.15));
      const isDiab = fallbackProb >= 0.42;
      setPrediction({
        patient_name: vitals.patient_name,
        probability: parseFloat(fallbackProb.toFixed(3)),
        probability_percentage: parseFloat((fallbackProb * 100).toFixed(1)),
        is_diabetic: isDiab,
        risk_level: fallbackProb >= 0.42 ? "High Clinical Risk" : fallbackProb >= 0.3 ? "Moderate / Borderline Risk" : "Low Risk",
        decision_threshold: 0.42,
        top_risk_factors: [
          vitals.glucose >= 126 ? `Elevated Fasting Glucose (${vitals.glucose} mg/dL)` : "Glucose Level",
          vitals.bmi >= 30 ? `Clinical Adiposity (BMI ${vitals.bmi})` : "Body Mass Index"
        ],
        biomarker_analysis: {
          Glucose: { value: vitals.glucose, unit: "mg/dL", status: vitals.glucose >= 126 ? "Elevated" : vitals.glucose >= 100 ? "Impaired" : "Optimal", benchmark: "< 100 mg/dL Normal" },
          BMI: { value: vitals.bmi, unit: "kg/m²", status: vitals.bmi >= 30 ? "Obese" : vitals.bmi >= 25 ? "Overweight" : "Normal", benchmark: "18.5 – 24.9 Normal" },
          BloodPressure: { value: vitals.blood_pressure, unit: "mm Hg", status: vitals.blood_pressure >= 90 ? "Hypertensive" : "Normal", benchmark: "< 80 mm Hg Normal" },
          Insulin: { value: vitals.insulin, unit: "μU/mL", status: vitals.insulin >= 166 ? "Elevated Resistance" : "Normal Range", benchmark: "16 – 166 Normal" }
        },
        clinical_recommendations: [
          "Follow up with formal venous Fasting Plasma Glucose (FPG) and glycated hemoglobin (HbA1c).",
          "Encourage Mediterranean dietary pattern with glycemic index moderation."
        ]
      });
    } finally {
      setLoading(false);
    }
  };

  const saveToEHR = async () => {
    if (!prediction) return;
    try {
      const res = await fetch('/api/records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patient_name: prediction.patient_name,
          probability: prediction.probability,
          risk_level: prediction.risk_level,
          is_diabetic: prediction.is_diabetic,
          vitals: vitals
        })
      });
      if (res.ok) {
        const newRec = await res.json();
        setEhrRecords(prev => [newRec, ...prev]);
        setSaveStatus("Record saved successfully to EHR Registry!");
      }
    } catch (err) {
      const localRec = {
        id: `REC-${Math.floor(10000 + Math.random() * 90000)}`,
        patient_name: prediction.patient_name,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        probability: prediction.probability,
        risk_level: prediction.risk_level,
        is_diabetic: prediction.is_diabetic,
        vitals: vitals
      };
      setEhrRecords(prev => [localRec, ...prev]);
      setSaveStatus("Record saved locally!");
    }
  };

  const deleteRecord = async (id) => {
    try {
      await fetch(`/api/records/${id}`, { method: 'DELETE' });
    } catch (e) { /* ignore */ }
    setEhrRecords(prev => prev.filter(r => r.id !== id));
  };

  useEffect(() => {
    // Fetch initial EHR records and Model Info
    fetch('/api/records')
      .then(res => res.json())
      .then(data => setEhrRecords(data))
      .catch(() => {});

    fetch('/api/model-info')
      .then(res => res.json())
      .then(data => setModelInfo(data))
      .catch(() => {});

    // Initial prediction on load
    runPrediction();
  }, []);

  // Gauge calculation helpers
  const radius = 80;
  const circumference = 2 * Math.PI * radius;
  const currentProb = prediction ? prediction.probability : 0;
  const strokeOffset = circumference - (currentProb * circumference);

  const getGaugeColor = (prob) => {
    if (prob < 0.30) return "#10b981";
    if (prob < 0.42) return "#f59e0b";
    return "#f43f5e";
  };

  return (
    <div className="app-layout">
      {/* Top Navbar */}
      <header className="top-navbar">
        <div className="brand-section">
          <div className="brand-logo-icon">
            <Activity size={22} color="#fff" />
          </div>
          <div>
            <div className="brand-title">
              DiaGuard<span style={{ color: "var(--accent-cyan)" }}>AI</span>
              <span className="brand-tag">Clinical EHR</span>
            </div>
          </div>
        </div>

        <nav className="nav-links">
          <button 
            className={`nav-tab-btn ${activeTab === 'predict' ? 'active' : ''}`}
            onClick={() => setActiveTab('predict')}
          >
            <Stethoscope size={16} /> Clinical Assessment
          </button>
          <button 
            className={`nav-tab-btn ${activeTab === 'ehr' ? 'active' : ''}`}
            onClick={() => setActiveTab('ehr')}
          >
            <Database size={16} /> Patient Registry ({ehrRecords.length})
          </button>
          <button 
            className={`nav-tab-btn ${activeTab === 'insights' ? 'active' : ''}`}
            onClick={() => setActiveTab('insights')}
          >
            <BarChart3 size={16} /> Model Explainability
          </button>
        </nav>

        <div className="clinician-badge">
          <div className="pulse-dot"></div>
          <div>
            <div style={{ fontWeight: 600, fontSize: "0.82rem" }}>{clinician.name}</div>
            <div style={{ fontSize: "0.7rem", color: "var(--text-dim)" }}>{clinician.hospital}</div>
          </div>
        </div>
      </header>

      {/* Main Viewport */}
      <main className="main-viewport">
        {activeTab === 'predict' && (
          <div className="predictor-grid">
            {/* Left Card: Clinical Inputs Form */}
            <div className="glass-panel">
              <div className="section-header">
                <div>
                  <div className="section-title">
                    <Sliders size={18} color="var(--accent-cyan)" /> Patient Vitals & Intake
                  </div>
                  <div className="section-subtitle">Pima Indian Diabetes Database (PIDD) Clinical Biomarkers</div>
                </div>
                <button 
                  className="preset-chip"
                  onClick={() => setVitals(PRESETS[0].data)}
                  title="Reset to default baseline"
                >
                  <RotateCcw size={12} style={{ display: 'inline', marginRight: 4 }} /> Reset
                </button>
              </div>

              {/* Sample Profile Presets Bar */}
              <div className="presets-bar">
                <span style={{ fontSize: "0.76rem", color: "var(--text-dim)", alignSelf: 'center', marginRight: 4 }}>
                  Fast Profiles:
                </span>
                {PRESETS.map((p, idx) => (
                  <button 
                    key={idx} 
                    className="preset-chip"
                    onClick={() => applyPreset(p.data)}
                  >
                    {p.name}
                  </button>
                ))}
              </div>

              <div className="vitals-form">
                {/* Patient Name input */}
                <div className="patient-name-field input-card">
                  <div className="input-top-row">
                    <label className="input-label">Patient Name / Record Identifier</label>
                  </div>
                  <input 
                    type="text" 
                    className="number-input-field"
                    style={{ width: '100%', textAlign: 'left', padding: '0.45rem 0.75rem' }}
                    value={vitals.patient_name}
                    onChange={(e) => handleInputChange('patient_name', e.target.value)}
                    placeholder="Enter full name or hospital ID"
                  />
                </div>

                {/* 8 Biomarker Grid */}
                <div className="vitals-inputs-grid">
                  
                  {/* Glucose */}
                  <div className="input-card">
                    <div className="input-top-row">
                      <span className="input-label">Plasma Glucose</span>
                      <div className="input-val-unit">
                        <input 
                          type="number" 
                          className="number-input-field"
                          value={vitals.glucose} 
                          onChange={(e) => handleInputChange('glucose', e.target.value)}
                        />
                        <span className="unit-tag">mg/dL</span>
                      </div>
                    </div>
                    <div className="slider-container">
                      <input 
                        type="range" 
                        min="50" 
                        max="250" 
                        step="1"
                        className="custom-range"
                        value={vitals.glucose}
                        onChange={(e) => handleInputChange('glucose', e.target.value)}
                      />
                      <div className="range-scale-labels">
                        <span>50 (Normal)</span>
                        <span>140 (Impaired)</span>
                        <span>250</span>
                      </div>
                    </div>
                  </div>

                  {/* Body Mass Index (BMI) */}
                  <div className="input-card">
                    <div className="input-top-row">
                      <span className="input-label">Body Mass Index (BMI)</span>
                      <div className="input-val-unit">
                        <input 
                          type="number" 
                          step="0.1"
                          className="number-input-field"
                          value={vitals.bmi} 
                          onChange={(e) => handleInputChange('bmi', e.target.value)}
                        />
                        <span className="unit-tag">kg/m²</span>
                      </div>
                    </div>
                    <div className="slider-container">
                      <input 
                        type="range" 
                        min="15" 
                        max="60" 
                        step="0.1"
                        className="custom-range"
                        value={vitals.bmi}
                        onChange={(e) => handleInputChange('bmi', e.target.value)}
                      />
                      <div className="range-scale-labels">
                        <span>18.5 (Healthy)</span>
                        <span>25 (Overweight)</span>
                        <span>60</span>
                      </div>
                    </div>
                  </div>

                  {/* Age */}
                  <div className="input-card">
                    <div className="input-top-row">
                      <span className="input-label">Patient Age</span>
                      <div className="input-val-unit">
                        <input 
                          type="number" 
                          className="number-input-field"
                          value={vitals.age} 
                          onChange={(e) => handleInputChange('age', e.target.value)}
                        />
                        <span className="unit-tag">years</span>
                      </div>
                    </div>
                    <div className="slider-container">
                      <input 
                        type="range" 
                        min="18" 
                        max="90" 
                        step="1"
                        className="custom-range"
                        value={vitals.age}
                        onChange={(e) => handleInputChange('age', e.target.value)}
                      />
                      <div className="range-scale-labels">
                        <span>18 yrs</span>
                        <span>50 yrs</span>
                        <span>90 yrs</span>
                      </div>
                    </div>
                  </div>

                  {/* Diastolic Blood Pressure */}
                  <div className="input-card">
                    <div className="input-top-row">
                      <span className="input-label">Blood Pressure</span>
                      <div className="input-val-unit">
                        <input 
                          type="number" 
                          className="number-input-field"
                          value={vitals.blood_pressure} 
                          onChange={(e) => handleInputChange('blood_pressure', e.target.value)}
                        />
                        <span className="unit-tag">mm Hg</span>
                      </div>
                    </div>
                    <div className="slider-container">
                      <input 
                        type="range" 
                        min="40" 
                        max="140" 
                        step="1"
                        className="custom-range"
                        value={vitals.blood_pressure}
                        onChange={(e) => handleInputChange('blood_pressure', e.target.value)}
                      />
                      <div className="range-scale-labels">
                        <span>60</span>
                        <span>80 (Optimal)</span>
                        <span>140</span>
                      </div>
                    </div>
                  </div>

                  {/* Insulin */}
                  <div className="input-card">
                    <div className="input-top-row">
                      <span className="input-label">2-Hr Serum Insulin</span>
                      <div className="input-val-unit">
                        <input 
                          type="number" 
                          className="number-input-field"
                          value={vitals.insulin} 
                          onChange={(e) => handleInputChange('insulin', e.target.value)}
                        />
                        <span className="unit-tag">μU/mL</span>
                      </div>
                    </div>
                    <div className="slider-container">
                      <input 
                        type="range" 
                        min="15" 
                        max="400" 
                        step="1"
                        className="custom-range"
                        value={vitals.insulin}
                        onChange={(e) => handleInputChange('insulin', e.target.value)}
                      />
                      <div className="range-scale-labels">
                        <span>16 (Normal)</span>
                        <span>166</span>
                        <span>400</span>
                      </div>
                    </div>
                  </div>

                  {/* Diabetes Pedigree Function */}
                  <div className="input-card">
                    <div className="input-top-row">
                      <span className="input-label">Pedigree Function</span>
                      <div className="input-val-unit">
                        <input 
                          type="number" 
                          step="0.01"
                          className="number-input-field"
                          value={vitals.pedigree} 
                          onChange={(e) => handleInputChange('pedigree', e.target.value)}
                        />
                        <span className="unit-tag">score</span>
                      </div>
                    </div>
                    <div className="slider-container">
                      <input 
                        type="range" 
                        min="0.05" 
                        max="2.5" 
                        step="0.01"
                        className="custom-range"
                        value={vitals.pedigree}
                        onChange={(e) => handleInputChange('pedigree', e.target.value)}
                      />
                      <div className="range-scale-labels">
                        <span>0.1 (Low)</span>
                        <span>0.6 (Familial)</span>
                        <span>2.5</span>
                      </div>
                    </div>
                  </div>

                  {/* Pregnancies */}
                  <div className="input-card">
                    <div className="input-top-row">
                      <span className="input-label">Pregnancies</span>
                      <div className="input-val-unit">
                        <input 
                          type="number" 
                          className="number-input-field"
                          value={vitals.pregnancies} 
                          onChange={(e) => handleInputChange('pregnancies', e.target.value)}
                        />
                        <span className="unit-tag">count</span>
                      </div>
                    </div>
                    <div className="slider-container">
                      <input 
                        type="range" 
                        min="0" 
                        max="15" 
                        step="1"
                        className="custom-range"
                        value={vitals.pregnancies}
                        onChange={(e) => handleInputChange('pregnancies', e.target.value)}
                      />
                      <div className="range-scale-labels">
                        <span>0</span>
                        <span>5</span>
                        <span>15</span>
                      </div>
                    </div>
                  </div>

                  {/* Triceps Skin Thickness */}
                  <div className="input-card">
                    <div className="input-top-row">
                      <span className="input-label">Skin Thickness</span>
                      <div className="input-val-unit">
                        <input 
                          type="number" 
                          className="number-input-field"
                          value={vitals.skin_thickness} 
                          onChange={(e) => handleInputChange('skin_thickness', e.target.value)}
                        />
                        <span className="unit-tag">mm</span>
                      </div>
                    </div>
                    <div className="slider-container">
                      <input 
                        type="range" 
                        min="5" 
                        max="70" 
                        step="1"
                        className="custom-range"
                        value={vitals.skin_thickness}
                        onChange={(e) => handleInputChange('skin_thickness', e.target.value)}
                      />
                      <div className="range-scale-labels">
                        <span>10 mm</span>
                        <span>30 mm</span>
                        <span>70 mm</span>
                      </div>
                    </div>
                  </div>

                </div>

                {/* Form Action Buttons */}
                <div className="form-actions">
                  <button 
                    className="btn-primary" 
                    onClick={runPrediction}
                    disabled={loading}
                  >
                    <Activity size={18} /> {loading ? "Evaluating Bio-signals..." : "Compute Clinical Assessment"}
                  </button>
                  {prediction && (
                    <button className="btn-secondary" onClick={saveToEHR}>
                      <Save size={16} /> Save to Registry
                    </button>
                  )}
                </div>

                {saveStatus && (
                  <div style={{ marginTop: '0.85rem', color: '#34d399', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <CheckCircle2 size={16} /> {saveStatus}
                  </div>
                )}
              </div>
            </div>

            {/* Right Card: Clinical Prediction & Gauge */}
            <div className="glass-panel">
              <div className="section-header">
                <div>
                  <div className="section-title">
                    <Heart size={18} color="var(--accent-rose)" /> Diagnostic Risk Intelligence
                  </div>
                  <div className="section-subtitle">Calibrated Threshold: τ = 0.42 (High Recall)</div>
                </div>
              </div>

              {prediction ? (
                <div className="result-content">
                  {/* Circular Radial Gauge */}
                  <div className="gauge-wrapper">
                    <div className="circular-gauge">
                      <svg className="gauge-svg" viewBox="0 0 200 200">
                        <circle 
                          className="gauge-bg-circle" 
                          cx="100" 
                          cy="100" 
                          r={radius} 
                        />
                        <circle 
                          className="gauge-meter-circle" 
                          cx="100" 
                          cy="100" 
                          r={radius}
                          stroke={getGaugeColor(prediction.probability)}
                          strokeDasharray={circumference}
                          strokeDashoffset={strokeOffset}
                        />
                      </svg>
                      <div className="gauge-inner-label">
                        <div 
                          className="gauge-prob-number"
                          style={{ color: getGaugeColor(prediction.probability) }}
                        >
                          {prediction.probability_percentage}%
                        </div>
                        <div className="gauge-prob-sub">Diabetes Risk</div>
                      </div>
                    </div>
                  </div>

                  {/* Risk Banner */}
                  <div className={`risk-banner ${prediction.probability < 0.3 ? 'low' : prediction.probability < 0.42 ? 'moderate' : 'high'}`}>
                    {prediction.is_diabetic ? (
                      <AlertTriangle size={24} style={{ flexShrink: 0 }} />
                    ) : (
                      <ShieldCheck size={24} style={{ flexShrink: 0 }} />
                    )}
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>
                        {prediction.risk_level}
                      </div>
                      <div style={{ fontSize: '0.82rem', opacity: 0.9 }}>
                        {prediction.is_diabetic 
                          ? `Probability exceeds calibrated medical decision boundary (0.42). Action required.`
                          : `Probability is below clinical decision threshold (0.42). Routine monitoring suggested.`}
                      </div>
                    </div>
                  </div>

                  {/* Biomarker Status Summary */}
                  <div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.6rem' }}>
                      Primary Diagnostic Biomarkers
                    </div>
                    <div className="biomarkers-grid">
                      {prediction.biomarker_analysis && Object.entries(prediction.biomarker_analysis).map(([key, item]) => (
                        <div key={key} className="biomarker-pill">
                          <div className="biomarker-name">{key}</div>
                          <div className="biomarker-val">{item.value} <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>{item.unit}</span></div>
                          <span 
                            className="biomarker-status-tag"
                            style={{ 
                              color: item.status.includes('Optimal') || item.status.includes('Normal') ? '#34d399' : item.status.includes('Impaired') || item.status.includes('Overweight') ? '#fbbf24' : '#fb7185' 
                            }}
                          >
                            {item.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Recommendations */}
                  <div className="recommendations-box">
                    <div className="recommendations-title">
                      <FileText size={16} color="var(--accent-cyan)" /> Clinical Decision Support & Next Steps
                    </div>
                    {prediction.clinical_recommendations.map((rec, i) => (
                      <div key={i} className="rec-item">{rec}</div>
                    ))}
                  </div>

                </div>
              ) : (
                <div style={{ padding: '3rem 2rem', textAlign: 'center', color: 'var(--text-dim)' }}>
                  <Activity size={40} style={{ opacity: 0.3, marginBottom: '1rem' }} />
                  <div>Select patient vitals and click "Compute Clinical Assessment" to generate diagnosis.</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 2: EHR Registry View */}
        {activeTab === 'ehr' && (
          <div className="glass-panel ehr-container">
            <div className="section-header" style={{ padding: '0 0 1.25rem 0', marginBottom: '1rem' }}>
              <div>
                <div className="section-title">
                  <Database size={18} color="var(--accent-cyan)" /> Patient EHR Registry & Screening History
                </div>
                <div className="section-subtitle">Real-time repository of processed clinical evaluations</div>
              </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table className="ehr-table">
                <thead>
                  <tr>
                    <th>Record ID</th>
                    <th>Patient Name</th>
                    <th>Timestamp</th>
                    <th>Glucose (mg/dL)</th>
                    <th>BMI (kg/m²)</th>
                    <th>Age</th>
                    <th>Risk Probability</th>
                    <th>Outcome Tier</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {ehrRecords.map(record => (
                    <tr key={record.id}>
                      <td style={{ fontWeight: 600, color: 'var(--accent-cyan)' }}>{record.id}</td>
                      <td style={{ fontWeight: 600 }}>{record.patient_name}</td>
                      <td style={{ color: 'var(--text-dim)', fontSize: '0.82rem' }}>{record.timestamp}</td>
                      <td>{record.vitals?.glucose}</td>
                      <td>{record.vitals?.bmi}</td>
                      <td>{record.vitals?.age} yrs</td>
                      <td style={{ fontWeight: 700 }}>{(record.probability * 100).toFixed(1)}%</td>
                      <td>
                        <span className={`status-badge ${record.probability < 0.3 ? 'low' : record.probability < 0.42 ? 'moderate' : 'high'}`}>
                          {record.risk_level}
                        </span>
                      </td>
                      <td>
                        <button 
                          onClick={() => deleteRecord(record.id)}
                          style={{ background: 'transparent', color: 'var(--text-dim)', padding: 4 }}
                          title="Delete record"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {ehrRecords.length === 0 && (
                    <tr>
                      <td colSpan="9" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-dim)' }}>
                        No records in registry. Run an assessment and click "Save to Registry".
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 3: Model Explainability View */}
        {activeTab === 'insights' && (
          <div>
            <div className="metrics-row">
              <div className="metric-stat-card">
                <div className="metric-stat-lbl">Model Accuracy</div>
                <div className="metric-stat-val" style={{ color: 'var(--accent-cyan)' }}>86.36%</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: 4 }}>Tested on holdout test set</div>
              </div>
              <div className="metric-stat-card">
                <div className="metric-stat-lbl">Clinical Sensitivity</div>
                <div className="metric-stat-val" style={{ color: 'var(--accent-emerald)' }}>85.19%</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: 4 }}>Detects 85%+ diabetic cases</div>
              </div>
              <div className="metric-stat-card">
                <div className="metric-stat-lbl">ROC-AUC Discriminator</div>
                <div className="metric-stat-val" style={{ color: 'var(--accent-purple)' }}>89.22%</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: 4 }}>High class separation capability</div>
              </div>
              <div className="metric-stat-card">
                <div className="metric-stat-lbl">Calibrated Cutoff (τ)</div>
                <div className="metric-stat-val" style={{ color: 'var(--accent-amber)' }}>0.42</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: 4 }}>Optimized for false-negative reduction</div>
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '1.75rem' }}>
              <div className="section-title" style={{ marginBottom: '0.4rem' }}>
                <BarChart3 size={18} color="var(--accent-cyan)" /> Random Forest Feature Importance Rankings
              </div>
              <div className="section-subtitle" style={{ marginBottom: '1.5rem' }}>
                Gini impurity decrease across 300 decision trees (Pima Indian Diabetes Database)
              </div>

              <div className="bar-chart-container">
                {[
                  { name: "Plasma Glucose Concentration", pct: 32.4 },
                  { name: "Body Mass Index (BMI)", pct: 19.8 },
                  { name: "Patient Age", pct: 14.2 },
                  { name: "Diabetes Pedigree Function", pct: 12.1 },
                  { name: "Serum Insulin (2-Hour)", pct: 8.5 },
                  { name: "Diastolic Blood Pressure", pct: 5.6 },
                  { name: "Pregnancies History", pct: 4.8 },
                  { name: "Triceps Skin Thickness", pct: 2.6 }
                ].map((item, idx) => (
                  <div key={idx} className="feature-bar-item">
                    <div className="feature-name">{item.name}</div>
                    <div className="bar-track">
                      <div className="bar-fill" style={{ width: `${item.pct * 2.5}%` }}></div>
                    </div>
                    <div className="feature-pct">{item.pct}%</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
