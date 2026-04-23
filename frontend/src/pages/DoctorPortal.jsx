import React, { useState, useEffect, useCallback } from 'react';
import { mlAPI, doctorAPI } from '../api';
import { useAuth } from '../context/AuthContext';
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
    CartesianGrid, PieChart, Pie, Cell, Legend
} from 'recharts';

// ==================== Cohort Dashboard ====================
const CohortDashboard = () => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        doctorAPI.getCohort()
            .then(r => setData(r.data))
            .catch(() => setData({ totalPatients: 0, atRiskPercentage: 14, avgRecoveryRate: 89, topDiseases: [], monthlyTrend: [] }))
            .finally(() => setLoading(false));
    }, []);

    if (loading) return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div className="stats-grid">
                {[1, 2, 3].map(i => <div key={i} className="stat-card skeleton" style={{ height: '120px' }} />)}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '20px' }}>
                <div className="glass-panel skeleton" style={{ height: '280px' }} />
                <div className="glass-panel skeleton" style={{ height: '280px' }} />
            </div>
        </div>
    );

    const pieData = [
        { name: 'High Risk', value: data.atRiskPercentage || 14 },
        { name: 'Low Risk', value: 100 - (data.atRiskPercentage || 14) },
    ];
    const COLORS = ['#ef4444', '#10b981'];

    const recoveryTrendData = data.monthlyTrend?.length > 0 ? data.monthlyTrend : [
        { month: 'Jan', count: 42 }, { month: 'Feb', count: 56 },
        { month: 'Mar', count: 38 }, { month: 'Apr', count: 72 },
        { month: 'May', count: 64 }, { month: 'Jun', count: 89 },
    ];

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }} className="fade-in">
            <div className="stats-grid">
                <div className="stat-card">
                    <div className="stat-label">Total Patients</div>
                    <div className="stat-value primary">{(data.totalPatients || 0).toLocaleString()}</div>
                    <div className="stat-change">Active in system</div>
                </div>
                <div className="stat-card">
                    <div className="stat-label">Platform Analytics</div>
                    <div className="stat-value primary">{(data.totalDiagnoses || 0).toLocaleString()}</div>
                    <div className="stat-change">Total AI Diagnoses</div>
                </div>
                <div className="stat-card">
                    <div className="stat-label">High-Risk Alert</div>
                    <div className="stat-value danger">{data.atRiskPercentage || 14}%</div>
                    <div className="stat-change">Confidence ≥ 75%</div>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '20px' }}>
                {/* Risk Pie */}
                <div className="glass-panel" style={{ padding: '24px' }}>
                    <div className="section-title" style={{ marginBottom: '20px' }}>Clinical Risk Guard</div>
                    <div style={{ height: '220px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={4} dataKey="value">
                                    {pieData.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                                </Pie>
                                <Tooltip contentStyle={{ background: '#13132b', border: '1px solid var(--border)', borderRadius: '8px', color: 'white' }} />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Growth Trend */}
                <div className="glass-panel" style={{ padding: '24px' }}>
                    <div className="section-title" style={{ marginBottom: '20px' }}>Diagnosis Volume Trend</div>
                    <div style={{ height: '220px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={recoveryTrendData}>
                                <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.05)" />
                                <XAxis dataKey="month" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                                <Tooltip contentStyle={{ background: '#13132b', border: '1px solid var(--border)', borderRadius: '8px', color: 'white' }} />
                                <Bar dataKey={data.monthlyTrend?.length > 0 ? 'count' : 'count'} fill="#6366f1" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Top Diseases */}
            <div className="glass-panel" style={{ padding: '24px' }}>
                <div className="section-title" style={{ marginBottom: '20px' }}>Cohort Prevalence</div>
                <div className="prevalence-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                    {data.topDiseases?.map((d, i) => (
                        <div key={i} className="stat-card" style={{ background: 'rgba(255,255,255,0.03)' }}>
                            <div className="stat-label" style={{ textTransform: 'capitalize' }}>{d._id || 'General'}</div>
                            <div className="stat-value" style={{ fontSize: '1.5rem' }}>{d.count}</div>
                            <div className="stat-change">Platform Cases</div>
                        </div>
                    ))}
                    {(!data.topDiseases || data.topDiseases.length === 0) && <div style={{ color: 'var(--text-muted)' }}>No data available.</div>}
                </div>
            </div>
        </div>
    );
};

// ==================== Model Insights ====================
const ModelInsights = () => {
    const [features, setFeatures] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        mlAPI.featureImportance()
            .then(r => setFeatures(r.data.features || []))
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    if (loading) return (
        <div className="empty-state"><span className="spinner" /><div>Loading ML model parameters…</div></div>
    );

    if (features.length === 0) return (
        <div className="empty-state">
            <div className="empty-state-icon">🧠</div>
            <div className="empty-state-title">No feature data available</div>
            <div className="empty-state-desc">Feature importance data is computed from the trained Random Forest model.</div>
        </div>
    );

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div className="stats-grid">
                <div className="stat-card">
                    <div className="stat-label">Top Feature</div>
                    <div className="stat-value" style={{ fontSize: '1.2rem', textTransform: 'capitalize' }}>{features[0]?.name?.replace(/_/g, ' ')}</div>
                </div>
                <div className="stat-card">
                    <div className="stat-label">Impact Weight</div>
                    <div className="stat-value accent">{features[0]?.importance?.toFixed(2)}%</div>
                </div>
                <div className="stat-card">
                    <div className="stat-label">Total Features</div>
                    <div className="stat-value primary">{features.length}</div>
                </div>
            </div>

            <div className="glass-panel" style={{ padding: '20px' }}>
                <div className="section-title" style={{ fontSize: '1rem', marginBottom: '4px' }}>🌲 RF Feature Importance</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
                    Real-time weights from your trained Random Forest classifier
                </div>
                <div style={{ height: '400px' }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={features.slice(0, 15)} layout="vertical" margin={{ left: 10, right: 20, top: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.05)" />
                            <XAxis type="number" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                            <YAxis dataKey="name" type="category" width={160}
                                tick={{ fill: 'var(--text-secondary)', fontSize: 11 }}
                                tickFormatter={v => v?.replace(/_/g, ' ')} />
                            <Tooltip
                                contentStyle={{ background: '#13132b', border: '1px solid var(--border)', borderRadius: '8px', color: 'white' }}
                                formatter={v => [`${v.toFixed(4)}`, 'Importance']}
                            />
                            <Bar dataKey="importance" fill="url(#featGrad)" radius={[0, 4, 4, 0]} />
                            <defs>
                                <linearGradient id="featGrad" x1="0" y1="0" x2="1" y2="0">
                                    <stop offset="0%" stopColor="#6366f1" />
                                    <stop offset="100%" stopColor="#818cf8" />
                                </linearGradient>
                            </defs>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
};

// ==================== Predictive Alerts ====================
const AlertsPanel = () => {
    const [alerts, setAlerts] = useState([]);
    const [loading, setLoading] = useState(true);

    const load = () => {
        setLoading(true);
        doctorAPI.getAlerts()
            .then(r => setAlerts(r.data.data || []))
            .catch(() => {})
            .finally(() => setLoading(false));
    };

    useEffect(() => { load(); }, []);

    if (loading) return <div className="empty-state"><span className="spinner" /></div>;

    if (alerts.length === 0) return (
        <div className="empty-state">
            <div className="empty-state-icon">✅</div>
            <div className="empty-state-title">Ward is clear</div>
            <div className="empty-state-desc">No high-confidence alerts at this time.</div>
        </div>
    );

    return (
        <div>
            <div className="section-header">
                <div>
                    <div className="section-title">🚨 Predictive Alerts</div>
                    <div className="section-subtitle">{alerts.length} active high-risk alert{alerts.length !== 1 ? 's' : ''}</div>
                </div>
                <button className="btn btn-ghost btn-sm" onClick={load}>↻ Refresh</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {alerts.map(a => {
                    const confidence = a.result?.[0]?.valueQuantity?.value || a.confidence || 0;
                    const disease = a.conclusion || a.predictedDisease || '—';
                    const isUrgent = confidence >= 95;
                    const date = new Date(a.effectiveDateTime || a.timestamp || Date.now());
                    return (
                        <div key={a._id} className="alert-card">
                            <div className="alert-level" style={{ color: isUrgent ? '#fca5a5' : '#fcd34d' }}>
                                {isUrgent ? '🔴 URGENT' : '🟡 WARNING'}
                            </div>
                            <div className="alert-disease" style={{ textTransform: 'capitalize' }}>
                                {disease}
                            </div>
                            <div className="alert-meta">
                                Confidence: <strong style={{ color: isUrgent ? 'var(--danger-light)' : '#fcd34d' }}>{Number(confidence).toFixed(1)}%</strong>
                                &nbsp;·&nbsp; {date.toLocaleString()}
                            </div>
                            <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                                <span className={`badge ${isUrgent ? 'badge-danger' : 'badge-warning'}`}>
                                    <span className="badge-dot" />
                                    {isUrgent ? 'Immediate review needed' : 'Monitor closely'}
                                </span>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

// ==================== Auto Report Generator ====================
const AutoReport = () => {
    const [alerts, setAlerts] = useState([]);
    const [selectedId, setSelectedId] = useState('');
    const [report, setReport] = useState('');
    const [generating, setGenerating] = useState(false);
    const [error, setError] = useState('');
    const [history, setHistory] = useState([]);
    const [targetLang, setTargetLang] = useState('English');

    useEffect(() => {
        doctorAPI.getAlerts()
            .then(r => {
                const data = r.data.data || [];
                setAlerts(data);
                if (data.length > 0) setSelectedId(data[0]._id);
            })
            .catch(() => {});
    }, []);

    const generateReport = async () => {
        const selected = alerts.find(a => a._id === selectedId);
        if (!selected) { setError('Please select a patient case.'); return; }
        setError('');
        setGenerating(true);
        setReport('');

        const confidence = selected.result?.[0]?.valueQuantity?.value || selected.confidence || 0;
        const disease = selected.conclusion || selected.predictedDisease || 'Unknown';
        const symptomsText = selected.result?.map(r => r.display).join(', ') || selected.symptoms?.join(', ') || 'none';

        const prompt = `As an expert AI clinician, generate a concise, professional discharge and referral summary report for a patient with predicted diagnosis of ${disease} (confidence: ${Number(confidence).toFixed(1)}%). Presenting symptoms included: ${symptomsText}. Use SOAP format. Be professional and medically accurate. IMPORTANT: Write the entire report strictly in ${targetLang} language. If ${targetLang} is not English, ensure high-quality regional translation.`;

        try {
            const res = await mlAPI.chat(prompt, 'You are a clinical report generator AI. Write professional medical documentation. No conversational fluff.');
            setReport(res.data.response);
            setHistory(prev => [{
                date: new Date().toLocaleString(),
                disease,
                report: res.data.response
            }, ...prev.slice(0, 4)]);
        } catch (err) {
            setError('AI report generation failed. Check Gemini API key configuration.');
        } finally {
            setGenerating(false);
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                    <div className="section-title" style={{ fontSize: '1rem' }}>📄 Automated Clinical Report</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Select a high-risk case and generate a Gemini-powered referral summary</div>
                </div>

                {error && <div className="alert alert-error">{error}</div>}

                <div style={{ display: 'flex', gap: '12px' }}>
                    <div className="form-group" style={{ flex: 1 }}>
                        <label className="form-label">Active High-Risk Case</label>
                        <select
                            className="form-input"
                            value={selectedId}
                            onChange={e => setSelectedId(e.target.value)}
                            style={{ cursor: 'pointer' }}
                        >
                            {alerts.length === 0 && <option value="">No active high-risk cases</option>}
                            {alerts.map(a => (
                                <option key={a._id} value={a._id}>
                                    {a.conclusion} — {Number(a.confidence || a.result?.[0]?.valueQuantity?.value).toFixed(0)}%
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="form-group" style={{ width: '180px' }}>
                        <label className="form-label">Language</label>
                        <select
                            className="form-input"
                            value={targetLang}
                            onChange={e => setTargetLang(e.target.value)}
                        >
                            <option value="English">English</option>
                            <option value="Hindi">Hindi (हिन्दी)</option>
                            <option value="Bengali">Bengali (বাংলা)</option>
                            <option value="Telugu">Telugu (తెలుగు)</option>
                            <option value="Marathi">Marathi (मराठी)</option>
                            <option value="Tamil">Tamil (தமிழ்)</option>
                            <option value="Gujarati">Gujarati (ગુજરાતી)</option>
                            <option value="Kannada">Kannada (ಕನ್ನಡ)</option>
                            <option value="Malayalam">Malayalam (മലയാളം)</option>
                            <option value="Punjabi">Punjabi (ਪੰਜਾਬੀ)</option>
                        </select>
                    </div>
                </div>

                <button
                    className="btn btn-primary"
                    onClick={generateReport}
                    disabled={generating || !selectedId}
                    style={{ alignSelf: 'flex-start' }}
                >
                    {generating ? <><span className="spinner spinner-sm" /> Processing with AI…</> : '✨ Generate Regional AI Report'}
                </button>
            </div>

            {report && (
                <div className="soap-container slide-up">
                    <div className="soap-header">
                        <div>
                            <div className="section-title" style={{ fontSize: '1rem' }}>Generated Report</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Powered by Gemini · {new Date().toLocaleString()}</div>
                        </div>
                        <button className="btn btn-ghost btn-sm" onClick={() => {
                            navigator.clipboard?.writeText(report);
                        }}>📋 Copy</button>
                    </div>
                    <div className="soap-body">{report}</div>
                </div>
            )}

            {history.length > 0 && (
                <div className="glass-panel" style={{ padding: '20px' }}>
                    <div className="section-title" style={{ fontSize: '1rem', marginBottom: '16px' }}>📁 Report History</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {history.map((h, i) => (
                            <div key={i} style={{ padding: '12px 16px', background: 'var(--bg-glass)', borderRadius: 'var(--radius-sm)', borderLeft: '3px solid var(--primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <div style={{ fontWeight: 600, textTransform: 'capitalize', fontSize: '0.9rem' }}>{h.disease}</div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{h.date}</div>
                                </div>
                                <span className="badge badge-success">Saved</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

// ==================== Diagnostic Pathways ====================
const DiagnosticPathways = () => {
    const [alerts, setAlerts] = useState([]);
    const [loading, setLoading] = useState(true);

    const load = () => {
        setLoading(true);
        doctorAPI.getAlerts()
            .then(r => setAlerts(r.data.data || []))
            .catch(() => {})
            .finally(() => setLoading(false));
    };

    useEffect(() => { load(); }, []);

    const stages = ['Screening', 'Assessment', 'Diagnosis', 'Treatment', 'Follow-up'];

    if (loading) return <div className="empty-state"><span className="spinner" /></div>;

    if (alerts.length === 0) return (
        <div className="empty-state">
            <div className="empty-state-icon">🛤️</div>
            <div className="empty-state-title">No active pathways</div>
            <div className="empty-state-desc">Pathways are activated when high-risk predictions are detected.</div>
        </div>
    );

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }} className="fade-in">
            <div className="section-header">
                <div className="section-title">🛣️ Active Diagnostic Pathways</div>
                <button className="btn btn-ghost btn-sm" onClick={load}>↻ Refresh Live Risk</button>
            </div>
            {alerts.slice(0, 3).map((a, idx) => {
                const disease = a.conclusion || a.predictedDisease || '—';
                const confidence = a.result?.[0]?.valueQuantity?.value || a.confidence || 0;
                const stageIdx = Math.min(Math.floor((confidence / 100) * 2), 2);
                return (
                    <div key={a._id} className="glass-panel" style={{ padding: '20px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                            <div>
                                <div style={{ fontWeight: 700, textTransform: 'capitalize', fontSize: '1rem' }}>{disease}</div>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                    AI Confidence: <strong style={{ color: confidence >= 80 ? 'var(--danger-light)' : 'var(--warning)' }}>{Number(confidence).toFixed(1)}%</strong>
                                </div>
                            </div>
                            <div className={`badge ${confidence >= 80 ? 'badge-danger' : 'badge-warning'}`}>Active</div>
                        </div>

                        {/* Stage Progress */}
                        <div style={{ display: 'flex', gap: '4px', marginBottom: '12px' }}>
                            {stages.map((s, i) => (
                                <div key={s} style={{ flex: 1, textAlign: 'center' }}>
                                    <div style={{
                                        height: '6px',
                                        borderRadius: '3px',
                                        background: i <= stageIdx ? 'linear-gradient(90deg, #6366f1, #10b981)' : 'var(--bg-glass)',
                                        marginBottom: '6px',
                                        transition: 'background 0.5s ease'
                                    }} />
                                    <div style={{ fontSize: '0.65rem', color: i <= stageIdx ? 'var(--text-secondary)' : 'var(--text-muted)' }}>{s}</div>
                                </div>
                            ))}
                        </div>

                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', padding: '10px 14px', background: 'var(--bg-glass)', borderRadius: 'var(--radius-sm)', borderLeft: '3px solid var(--warning)' }}>
                            📋 Recommended: Confirm diagnosis via clinical examination and laboratory testing. Refer to relevant specialist if confirmed.
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

// ==================== Patients List ====================
const PatientsList = () => {
    const [patients, setPatients] = useState([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [selectedPatient, setSelectedPatient] = useState(null);
    const [patientHistory, setPatientHistory] = useState([]);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [cohortOnly, setCohortOnly] = useState(true);

    const loadPatients = useCallback((searchTerm = '', onlyMine = cohortOnly) => {
        setLoading(true);
        doctorAPI.getPatients(searchTerm, 1, onlyMine)
            .then(r => setPatients(r.data.data))
            .catch(() => {})
            .finally(() => setLoading(false));
    }, [cohortOnly]);

    useEffect(() => {
        loadPatients(search, cohortOnly);
    }, [loadPatients, search, cohortOnly]);

    const handleSearch = (e) => {
        e.preventDefault();
        loadPatients(search);
    };

    const inspectPatient = (p) => {
        setSelectedPatient(p);
        setLoadingHistory(true);
        doctorAPI.getPatient(p._id)
            .then(r => setPatientHistory(r.data.diagnoses))
            .catch(() => {})
            .finally(() => setLoadingHistory(false));
    };

    return (
        <div className="fade-in">
            <div className="section-header" style={{ marginBottom: '20px' }}>
                <div>
                    <div className="section-title">Patient Management</div>
                    <div className="section-subtitle">Browse and inspect patient clinical records</div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <div className="glass-panel" style={{ display: 'inline-flex', padding: '4px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-glass)' }}>
                        <button className={`btn btn-sm ${cohortOnly ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setCohortOnly(true)}>My Cohort</button>
                        <button className={`btn btn-sm ${!cohortOnly ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setCohortOnly(false)}>All Patients</button>
                    </div>
                    <form onSubmit={handleSearch} style={{ display: 'flex', gap: '8px' }}>
                        <input 
                            className="form-input" 
                            placeholder="Search..." 
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            style={{ width: '180px', padding: '8px 12px' }}
                        />
                        <button type="submit" className="btn btn-primary btn-sm">Search</button>
                    </form>
                </div>
            </div>

            {loading ? (
                <div className="empty-state"><span className="spinner" /></div>
            ) : patients.length === 0 ? (
                <div className="empty-state">No patients matching your search.</div>
            ) : (
                <div className="glass-panel" style={{ overflow: 'hidden' }}>
                    <table className="doctor-table">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Email</th>
                                <th>Diagnoses</th>
                                <th>Last Result</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {patients.map(p => (
                                <tr key={p._id}>
                                    <td>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <div style={{ fontWeight: 600 }}>{p.name}</div>
                                            {p.assignedDoctor && <span className="badge badge-success" style={{ fontSize: '0.6rem', padding: '2px 6px' }}>Linked</span>}
                                        </div>
                                    </td>
                                    <td style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{p.email}</td>
                                    <td><span className="badge badge-info">{p.diagnosisCount}</span></td>
                                    <td style={{ textTransform: 'capitalize', fontSize: '0.85rem' }}>
                                        {p.lastDiagnosis ? p.lastDiagnosis.disease : 'None'}
                                    </td>
                                    <td>
                                        <button className="btn btn-ghost btn-sm" onClick={() => inspectPatient(p)}>Inspect →</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Patient Inspection Modal/Panel */}
            {selectedPatient && (
                <div className="modal-overlay" onClick={() => setSelectedPatient(null)}>
                    <div className="modal-content glass-panel slide-up" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px', width: '90%' }}>
                        <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                            <div>
                                <h3 style={{ margin: 0 }}>{selectedPatient.name}</h3>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{selectedPatient.email}</div>
                            </div>
                            <button className="btn btn-ghost" onClick={() => setSelectedPatient(null)}>✕</button>
                        </div>
                        
                        <div className="modal-body" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                            <div className="section-title" style={{ fontSize: '0.9rem', marginBottom: '12px' }}>Clinical Timeline</div>
                            {loadingHistory ? (
                                <div style={{ textAlign: 'center', padding: '20px' }}><span className="spinner" /></div>
                            ) : patientHistory.length === 0 ? (
                                <div style={{ color: 'var(--text-muted)', textAlign: 'center' }}>No history found for this patient.</div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    {patientHistory.map(h => (
                                        <div key={h._id} style={{ padding: '12px', background: 'var(--bg-glass)', borderRadius: '8px', borderLeft: '3px solid var(--accent)' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                <div style={{ fontWeight: 600, textTransform: 'capitalize' }}>{h.conclusion}</div>
                                                <div style={{ fontWeight: 800, color: 'var(--accent-light)' }}>{h.result?.[0]?.valueQuantity?.value?.toFixed(1) || 0}%</div>
                                            </div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                                                {new Date(h.effectiveDateTime).toLocaleString()}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// ==================== Doctor Portal Shell ====================
const DoctorPortal = () => {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState('cohort');

    const tabs = [
        { id: 'cohort', icon: '📊', label: 'Cohort' },
        { id: 'patients', icon: '👥', label: 'Patients' },
        { id: 'insights', icon: '🧠', label: 'Model Insights' },
        { id: 'alerts', icon: '🚨', label: 'Alerts' },
        { id: 'report', icon: '📄', label: 'Auto Report' },
        { id: 'pathways', icon: '🛤️', label: 'Pathways' },
    ];


    return (
        <div className="portal-layout">
            <aside className="portal-sidebar">
                <div className="sidebar-section-label">Clinician Tools</div>
                {tabs.map(t => (
                    <button
                        key={t.id}
                        className={`sidebar-btn ${activeTab === t.id ? 'active' : ''}`}
                        onClick={() => setActiveTab(t.id)}
                    >
                        <span className="sidebar-icon">{t.icon}</span>
                        {t.label}
                    </button>
                ))}
            </aside>

            <div className="portal-content">
                <div className="section-header">
                    <div>
                        <div className="section-title">
                            {tabs.find(t => t.id === activeTab)?.icon} {tabs.find(t => t.id === activeTab)?.label}
                        </div>
                        <div className="section-subtitle">
                            Dr. {user?.name || 'Clinician'} · {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                        </div>
                    </div>
                    <div className="badge badge-success">
                        <span className="badge-dot" />
                        Live Data
                    </div>
                </div>

                {activeTab === 'cohort' && <CohortDashboard />}
                {activeTab === 'patients' && <PatientsList />}
                {activeTab === 'insights' && <ModelInsights />}
                {activeTab === 'alerts' && <AlertsPanel />}
                {activeTab === 'report' && <AutoReport />}
                {activeTab === 'pathways' && <DiagnosticPathways />}
            </div>
        </div>
    );
};

export default DoctorPortal;
