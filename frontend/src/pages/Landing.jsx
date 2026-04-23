import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { systemAPI } from '../api';

const Landing = () => {
    const navigate = useNavigate();
    const [health, setHealth] = useState(null);
    const [loadingHealth, setLoadingHealth] = useState(true);

    useEffect(() => {
        systemAPI.health()
            .then(res => setHealth(res.data))
            .catch(() => setHealth({ backend: 'healthy', database: 'unknown', mlApi: 'unavailable' }))
            .finally(() => setLoadingHealth(false));
    }, []);

    const getStatusColor = (s) => {
        if (!s) return 'offline';
        const val = s.toLowerCase();
        if (val === 'healthy' || val === 'connected' || val === 'ok') return 'online';
        return 'offline';
    };

    return (
        <div className="landing-page slide-up">
            {/* Hero */}
            <div className="landing-hero">
                <div className="landing-badge">
                    <span style={{ fontSize: '1rem' }}>⚡</span>
                    VITA-CORE 2.0 &nbsp;·&nbsp; HL7 FHIR Compliant
                </div>
                <h1 className="landing-title">
                    AI-Powered<br />
                    <span className="gradient-text">Disease Prediction</span>
                </h1>
                <p className="landing-subtitle">
                    Multi-modal AI, explainable SHAP analysis, real-time clinical reasoning, 
                    and FHIR-compliant records — all in one unified health platform.
                </p>

                {/* Live System Status */}
                <div className="landing-health-status">
                    <div className="health-status-item">
                        <div className={`status-dot ${getStatusColor(health?.backend)}`} />
                        Backend {health?.backend || '–'}
                    </div>
                    <div className="health-status-item">
                        <div className={`status-dot ${getStatusColor(health?.database)}`} />
                        MongoDB {health?.database || '–'}
                    </div>
                    <div className="health-status-item">
                        <div className={`status-dot ${getStatusColor(health?.mlApi)}`} />
                        ML Engine {health?.mlApi || '–'}
                    </div>
                    {loadingHealth && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Checking systems…</span>}
                </div>
            </div>

            {/* Role Cards */}
            <div className="role-cards">
                <div
                    className="role-card patient-card"
                    onClick={() => navigate('/login?role=patient')}
                    role="button"
                    tabIndex={0}
                    onKeyDown={e => e.key === 'Enter' && navigate('/login?role=patient')}
                >
                    <div className="role-icon-wrapper patient">🧬</div>
                    <div>
                        <h2 className="role-card-title">Patient Portal</h2>
                        <p className="role-card-desc">
                            Describe your symptoms via text, voice, or image — let AI diagnose, explain, and guide you.
                        </p>
                    </div>
                    <ul className="role-features">
                        <li>AI multimodal symptom extraction</li>
                        <li>RF + KNN dual-model prediction</li>
                        <li>XAI explainability dashboard</li>
                        <li>Clinical SOAP note (Gemini AI)</li>
                        <li>40+ language translation</li>
                        <li>Health history timeline</li>
                    </ul>
                    <button className="btn btn-primary">
                        Enter Patient Portal →
                    </button>
                </div>

                <div
                    className="role-card doctor-card"
                    onClick={() => navigate('/login?role=doctor')}
                    role="button"
                    tabIndex={0}
                    onKeyDown={e => e.key === 'Enter' && navigate('/login?role=doctor')}
                >
                    <div className="role-icon-wrapper doctor">🩺</div>
                    <div>
                        <h2 className="role-card-title">Clinician Portal</h2>
                        <p className="role-card-desc">
                            Monitor cohort analytics, review AI alerts, and generate automated clinical reports.
                        </p>
                    </div>
                    <ul className="role-features">
                        <li>Live patient cohort analytics</li>
                        <li>RF feature importance charts</li>
                        <li>High-risk predictive alerts</li>
                        <li>AI-generated referral reports</li>
                        <li>Diagnostic pathway protocols</li>
                        <li>FHIR DiagnosticReport records</li>
                    </ul>
                    <button className="btn btn-accent">
                        Enter Clinician Portal →
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Landing;
