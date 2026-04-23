import React, { useState, useEffect, useRef } from 'react';
import { mlAPI, historyAPI, patientAPI } from '../api';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from 'recharts';

// ==================== Live Inference Status ====================
const InferenceWidget = () => {
    const { inferenceStatus } = useSocket();
    if (!inferenceStatus) return null;
    return (
        <div className="inference-widget fade-in">
            <div className="inference-header">
                <div className="inference-step">
                    <span className="pulse-dot" />
                    {inferenceStatus.message || 'Processing…'}
                </div>
                <span className="inference-pct">{inferenceStatus.progress}%</span>
            </div>
            <div className="progress-bar-container">
                <div className="progress-bar-fill" style={{ width: `${inferenceStatus.progress}%` }} />
            </div>
        </div>
    );
};

// ==================== Symptom Engine ====================
const SymptomEngine = ({ onResult }) => {
    const [symptoms, setSymptoms] = useState([]);
    const [allSymptoms, setAllSymptoms] = useState([]);
    const [search, setSearch] = useState('');
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [activeTab, setActiveTab] = useState('manual');
    const [textInput, setTextInput] = useState('');
    const [imagePreview, setImagePreview] = useState(null);
    const [imageData, setImageData] = useState(null);
    const [imageMime, setImageMime] = useState('');
    const [audioData, setAudioData] = useState(null);
    const [isRecording, setIsRecording] = useState(false);
    const [extracting, setExtracting] = useState(false);
    const [predicting, setPredicting] = useState(false);
    const [error, setError] = useState('');
    const mediaRef = useRef(null);
    const chunksRef = useRef([]);
    const searchRef = useRef(null);

    useEffect(() => {
        mlAPI.getSymptoms()
            .then(r => setAllSymptoms(r.data.symptoms || []))
            .catch(() => {});
    }, []);

    const filtered = allSymptoms.filter(
        s => s.toLowerCase().includes(search.toLowerCase()) && !symptoms.includes(s)
    );

    const addSymptom = (s) => {
        setSymptoms(prev => prev.includes(s) ? prev : [...prev, s]);
        setSearch('');
        setDropdownOpen(false);
    };

    const removeSymptom = (s) => setSymptoms(prev => prev.filter(x => x !== s));

    const handleImageUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onloadend = () => {
            setImagePreview(reader.result);
            setImageData(reader.result.replace(/^data:(.*,)?/, ''));
            setImageMime(file.type);
        };
        reader.readAsDataURL(file);
    };

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRef.current = new MediaRecorder(stream);
            chunksRef.current = [];
            mediaRef.current.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
            mediaRef.current.onstop = () => {
                const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
                const reader = new FileReader();
                reader.onloadend = () => setAudioData(reader.result.replace(/^data:(.*,)?/, ''));
                reader.readAsDataURL(blob);
                stream.getTracks().forEach(t => t.stop());
            };
            mediaRef.current.start();
            setIsRecording(true);
        } catch {
            setError('Microphone access denied.');
        }
    };

    const stopRecording = () => {
        mediaRef.current?.stop();
        setIsRecording(false);
    };

    const extractSymptoms = async () => {
        setError('');
        setExtracting(true);
        try {
            const payload = {};
            if (activeTab === 'text') payload.text = textInput;
            if (activeTab === 'image') { payload.image = imageData; payload.mime_type = imageMime; if (textInput) payload.text = textInput; }
            if (activeTab === 'voice') { payload.audio = audioData; payload.mime_type = 'audio/webm'; }
            const res = await mlAPI.extract(payload);
            if (res.data.success && res.data.symptoms.length > 0) {
                const newOnes = res.data.symptoms.filter(s => !symptoms.includes(s));
                setSymptoms(prev => [...prev, ...newOnes]);
                setTextInput('');
                setImageData(null); setImagePreview(null); setAudioData(null);
            } else {
                setError(res.data.message || 'No symptoms found in input.');
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Extraction failed. Check Gemini API key.');
        } finally {
            setExtracting(false);
        }
    };

    const runPrediction = async () => {
        if (symptoms.length === 0) { setError('Add at least one symptom.'); return; }
        setError('');
        setPredicting(true);
        try {
            const res = await mlAPI.predict(symptoms);
            onResult(res.data);
        } catch (err) {
            setError(err.response?.data?.message || 'Prediction engine error. Is the ML API running?');
        } finally {
            setPredicting(false);
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <InferenceWidget />

            {error && <div className="alert alert-error">{error}</div>}

            {/* Multimodal Tabs */}
            <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                        <div className="section-title" style={{ fontSize: '1rem' }}>✨ AI Symptom Extraction</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Use text, voice, or image — Gemini will extract symptoms</div>
                    </div>
                </div>

                <div className="symptom-tabs">
                    {['manual', 'text', 'voice', 'image'].map(t => (
                        <button key={t} className={`symptom-tab-btn ${activeTab === t ? 'active' : ''}`} onClick={() => setActiveTab(t)}>
                            {t === 'manual' ? '🔎 Search' : t === 'text' ? '📝 Text' : t === 'voice' ? '🎙️ Voice' : '📸 Image'}
                        </button>
                    ))}
                </div>

                {/* Manual Search */}
                {activeTab === 'manual' && (
                    <div style={{ position: 'relative', zIndex: 99999 }}>
                        <input
                            ref={searchRef}
                            className="symptom-search-input"
                            placeholder="Type symptoms (e.g. fever, cough)…"
                            value={search}
                            onChange={e => { setSearch(e.target.value); setDropdownOpen(true); }}
                            onFocus={() => setDropdownOpen(true)}
                            onBlur={() => setTimeout(() => setDropdownOpen(false), 200)}
                        />
                        {dropdownOpen && search && filtered.length > 0 && (
                            <div className="symptom-dropdown" style={{ display: 'block', visibility: 'visible', opacity: 1 }}>
                                {filtered.slice(0, 15).map(s => (
                                    <div key={s} className="symptom-option" onClick={() => addSymptom(s)}>
                                        {s.replace(/_/g, ' ')}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Text Input */}
                {activeTab === 'text' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <textarea
                            className="multi-textarea"
                            placeholder="Describe your symptoms in plain language… e.g. 'I've had a persistent headache, fever, and feeling nauseous for 3 days'"
                            value={textInput}
                            onChange={e => setTextInput(e.target.value)}
                        />
                        <button className="btn btn-primary" onClick={extractSymptoms} disabled={extracting || !textInput}>
                            {extracting ? <><span className="spinner spinner-sm" /> Analyzing…</> : '✨ Extract Symptoms with AI'}
                        </button>
                    </div>
                )}

                {/* Voice Input */}
                {activeTab === 'voice' && (
                    <div className="voice-section">
                        <button className={`mic-btn ${isRecording ? 'recording' : ''}`} onClick={isRecording ? stopRecording : startRecording}>
                            {isRecording ? '⏹️' : '🎤'}
                        </button>
                        <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                            {isRecording ? 'Recording… click to stop' : 'Click to start recording'}
                        </div>
                        {audioData && !isRecording && (
                            <>
                                <div className="badge badge-success">✅ Audio captured</div>
                                <button className="btn btn-primary" onClick={extractSymptoms} disabled={extracting}>
                                    {extracting ? <><span className="spinner spinner-sm" /> Analyzing…</> : '✨ Extract from Voice'}
                                </button>
                            </>
                        )}
                    </div>
                )}

                {/* Image Upload */}
                {activeTab === 'image' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {!imagePreview ? (
                            <label className="upload-zone" htmlFor="img-upload" style={{ cursor: 'pointer' }}>
                                <div style={{ fontSize: '2rem', marginBottom: '8px' }}>📁</div>
                                <div style={{ fontWeight: 600 }}>Click to upload medical image</div>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Lab reports, X-rays, skin photos</div>
                                <input id="img-upload" type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageUpload} />
                            </label>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                <img src={imagePreview} alt="Preview" style={{ maxHeight: '200px', objectFit: 'contain', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }} />
                                <textarea className="multi-textarea" placeholder="Optional: add context about the image…" value={textInput} onChange={e => setTextInput(e.target.value)} style={{ minHeight: '70px' }} />
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <button className="btn btn-primary" onClick={extractSymptoms} disabled={extracting}>
                                        {extracting ? <><span className="spinner spinner-sm" /> Analyzing…</> : '✨ Extract from Image'}
                                    </button>
                                    <button className="btn btn-ghost btn-sm" onClick={() => { setImagePreview(null); setImageData(null); }}>Remove</button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Selected Symptoms */}
            <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div className="section-title" style={{ fontSize: '1rem' }}>🎯 Selected Symptoms</div>
                    {symptoms.length > 0 && (
                        <button className="btn btn-ghost btn-sm" onClick={() => setSymptoms([])}>Clear all</button>
                    )}
                </div>

                {symptoms.length === 0 ? (
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem', padding: '12px 0' }}>
                        No symptoms selected yet. Use search or AI extraction above.
                    </div>
                ) : (
                    <div className="chips-container">
                        {symptoms.map(s => (
                            <div key={s} className="chip">
                                {s.replace(/_/g, ' ')}
                                <span className="chip-remove" onClick={() => removeSymptom(s)}>×</span>
                            </div>
                        ))}
                    </div>
                )}

                <button
                    className="btn btn-primary btn-full"
                    onClick={runPrediction}
                    disabled={predicting || symptoms.length === 0}
                    style={{ marginTop: '8px', padding: '16px' }}
                >
                    {predicting ? (
                        <><span className="spinner spinner-sm" /> Running AI Diagnosis…</>
                    ) : `🔬 Run Diagnosis (${symptoms.length} symptom${symptoms.length !== 1 ? 's' : ''})`}
                </button>
            </div>
        </div>
    );
};

// ==================== Diagnosis Result ====================
const DiagnosisResult = ({ result, onReset }) => {
    const [translating, setTranslating] = useState(false);
    const [translation, setTranslation] = useState('');
    const [activeLang, setActiveLang] = useState('');

    const { final_prediction, rf_prediction, knn_prediction, disease_info, xai_explanation, agentic_soap_note, related_symptoms } = result;

    const xaiData = (xai_explanation || []).slice(0, 10).map(e => ({
        name: e.feature?.replace(/_/g, ' ') || e.symptom,
        value: Math.abs(e.impact || e.shap_value || 0),
        raw: e.impact || e.shap_value || 0,
    }));

    const translateReport = async (lang) => {
        if (!agentic_soap_note) return;
        setTranslating(true);
        setActiveLang(lang);
        try {
            const res = await mlAPI.translate(agentic_soap_note, lang);
            setTranslation(res.data.translation || '');
        } catch { setTranslation('Translation failed.'); }
        finally { setTranslating(false); }
    };

    const confidenceLevel = final_prediction.confidence;
    const confColor = confidenceLevel >= 80 ? 'var(--accent)' : confidenceLevel >= 60 ? 'var(--warning)' : 'var(--danger)';

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }} className="slide-up">
            {/* Banner */}
            <div className="diagnosis-banner">
                <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap' }}>
                    <div className="confidence-ring" style={{ borderTopColor: confColor }}>
                        <div className="confidence-value" style={{ color: confColor }}>
                            {final_prediction.confidence.toFixed(0)}%
                        </div>
                        <div className="confidence-label">Confidence</div>
                    </div>
                    <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px' }}>
                            Primary Diagnosis
                        </div>
                        <h2 style={{ fontFamily: 'Outfit', fontSize: 'clamp(1.5rem, 4vw, 2.2rem)', fontWeight: 900, textTransform: 'capitalize', marginBottom: '8px' }}>
                            {final_prediction.disease}
                        </h2>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            <span className="badge badge-primary">RF: {rf_prediction?.confidence?.toFixed(1)}%</span>
                            <span className="badge badge-success">KNN: {knn_prediction?.confidence?.toFixed(1)}%</span>
                            <span className="badge badge-warning">Engine: {final_prediction.model_used}</span>
                        </div>
                    </div>
                    <button className="btn btn-ghost btn-sm" onClick={onReset}>
                        ← New Diagnosis
                    </button>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
                {/* Description & Precautions */}
                <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div className="section-title" style={{ fontSize: '1rem' }}>📋 Clinical Overview</div>
                    <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: '1.7' }}>
                        {disease_info?.description || 'No description available.'}
                    </p>
                    {disease_info?.precautions?.length > 0 && (
                        <>
                            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                                Recommended Precautions
                            </div>
                            <ul className="precautions-list">
                                {disease_info.precautions.map((p, i) => <li key={i}>{p}</li>)}
                            </ul>
                        </>
                    )}
                </div>

                {/* Related Symptoms */}
                {related_symptoms?.length > 0 && (
                    <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div className="section-title" style={{ fontSize: '1rem' }}>🕸️ GNN: Related Symptoms</div>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Co-occurring symptoms identified via Graph Neural Network analysis</p>
                        <div className="chips-container">
                            {related_symptoms.map(s => (
                                <div key={s} className="chip" style={{ background: 'rgba(245,158,11,0.1)', borderColor: 'rgba(245,158,11,0.3)', color: '#fcd34d' }}>
                                    {s.replace(/_/g, ' ')}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* XAI Dashboard */}
            {xaiData.length > 0 && (
                <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div>
                        <div className="section-title" style={{ fontSize: '1rem' }}>📊 SHAP Explainability (XAI)</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Feature impact scores from your Random Forest model</div>
                    </div>
                    <div style={{ height: '260px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={xaiData} layout="vertical" margin={{ left: 10, right: 20 }}>
                                <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.05)" />
                                <XAxis type="number" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                                <YAxis dataKey="name" type="category" width={140} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                                <Tooltip
                                    contentStyle={{ background: '#13132b', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-primary)' }}
                                    formatter={v => [v.toFixed(4), 'Impact']}
                                />
                                <Bar dataKey="value" fill="url(#xaiGrad)" radius={[0, 4, 4, 0]} />
                                <defs>
                                    <linearGradient id="xaiGrad" x1="0" y1="0" x2="1" y2="0">
                                        <stop offset="0%" stopColor="#6366f1" />
                                        <stop offset="100%" stopColor="#10b981" />
                                    </linearGradient>
                                </defs>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}

            {/* SOAP Note */}
            {agentic_soap_note && (
                <div className="soap-container">
                    <div className="soap-header">
                        <div>
                            <div className="section-title" style={{ fontSize: '1rem' }}>🧑‍⚕️ Agentic SOAP Note</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Generated by Gemini AI · FHIR DiagnosticReport</div>
                        </div>
                        <div className="language-selector-bar">
                            {[
                                { name: 'Hindi', label: 'हिन्दी' },
                                { name: 'Bengali', label: 'বাংলা' },
                                { name: 'Telugu', label: 'తెలుగు' },
                                { name: 'Marathi', label: 'मराठी' },
                                { name: 'Tamil', label: 'தமிழ்' },
                                { name: 'Gujarati', label: 'ગુજરાતી' },
                                { name: 'Kannada', label: 'ಕನ್ನಡ' },
                                { name: 'Malayalam', label: 'മലയാളം' },
                                { name: 'Punjabi', label: 'ਪੰਜਾਬੀ' }
                            ].map(lang => (
                                <button
                                    key={lang.name}
                                    className={`btn btn-ghost btn-sm ${activeLang === lang.name ? 'btn-primary' : ''}`}
                                    onClick={() => translateReport(lang.name)}
                                    disabled={translating}
                                    style={activeLang === lang.name ? { background: 'var(--primary)', color: 'white' } : {}}
                                >
                                    {lang.label}
                                </button>
                            ))}
                            {translation && <button className="btn btn-ghost btn-sm" onClick={() => { setTranslation(''); setActiveLang(''); }}>Original (English)</button>}
                        </div>
                    </div>
                    <div className="soap-body">
                        {translating ? (
                            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', color: 'var(--text-muted)' }}>
                                <span className="spinner spinner-sm" /> Translating with Gemini…
                            </div>
                        ) : (translation || agentic_soap_note)}
                    </div>
                </div>
            )}

            {/* Model Comparison */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                {[
                    { label: '🌲 Random Forest', pred: rf_prediction, color: '#6366f1' },
                    { label: '🎯 K-Nearest Neighbors', pred: knn_prediction, color: '#10b981' },
                ].map(({ label, pred, color }) => (
                    <div key={label} className="glass-panel" style={{ padding: '20px' }}>
                        <div style={{ fontWeight: 600, marginBottom: '12px' }}>{label}</div>
                        <div style={{ fontFamily: 'Outfit', fontSize: '1.3rem', fontWeight: 700, textTransform: 'capitalize', marginBottom: '4px' }}>
                            {pred?.disease}
                        </div>
                        <div style={{ color, fontFamily: 'Outfit', fontWeight: 800, fontSize: '1.8rem' }}>
                            {pred?.confidence?.toFixed(1)}%
                        </div>
                        {pred?.top_5?.slice(1, 4).map((p, i) => (
                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '6px', padding: '4px 8px', background: 'var(--bg-glass)', borderRadius: '6px' }}>
                                <span style={{ textTransform: 'capitalize' }}>{p.disease}</span>
                                <span>{p.probability?.toFixed(1)}%</span>
                            </div>
                        ))}
                    </div>
                ))}
            </div>

            <div className="alert alert-info" style={{ fontSize: '0.8rem' }}>
                ⚠️ This AI prediction is for informational purposes only. Always consult a licensed medical professional for diagnosis and treatment.
            </div>
        </div>
    );
};

// ==================== History Timeline ====================
const HistorySection = () => {
    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(true);
    const [deleting, setDeleting] = useState(null);

    const load = () => {
        setLoading(true);
        historyAPI.getAll()
            .then(r => setRecords(r.data.data || []))
            .catch(() => {})
            .finally(() => setLoading(false));
    };

    useEffect(() => { load(); }, []);

    const handleDelete = async (id) => {
        setDeleting(id);
        try {
            await historyAPI.deleteById(id);
            setRecords(prev => prev.filter(r => r._id !== id));
        } catch {}
        finally { setDeleting(null); }
    };

    if (loading) return <div className="empty-state"><span className="spinner" /></div>;

    if (records.length === 0) return (
        <div className="empty-state">
            <div className="empty-state-icon">📜</div>
            <div className="empty-state-title">No diagnoses yet</div>
            <div className="empty-state-desc">Run your first AI diagnosis to see your history here.</div>
        </div>
    );

    return (
        <div>
            <div className="section-header">
                <div><div className="section-title">Clinical History</div><div className="section-subtitle">{records.length} record{records.length !== 1 ? 's' : ''} found</div></div>
                <button className="btn btn-ghost btn-sm" onClick={load}>↻ Refresh</button>
            </div>
            <div className="timeline">
                {records.map(h => {
                    const date = new Date(h.effectiveDateTime || h.timestamp || Date.now());
                    const disease = h.conclusion || h.predictedDisease || '—';
                    const confidence = h.result?.[0]?.valueQuantity?.value || h.confidence || 0;
                    const symptoms = h.result?.map(r => r.display) || h.symptoms || [];
                    return (
                        <div key={h._id} className="timeline-card">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
                                <div className="timeline-date">
                                    <div className="timeline-date-day">{date.getDate()}</div>
                                    <div className="timeline-date-month">{date.toLocaleString('default', { month: 'short' })}</div>
                                </div>
                                <div style={{ minWidth: 0 }}>
                                    <div className="timeline-disease" style={{ textTransform: 'capitalize' }}>{disease}</div>
                                    <div className="timeline-symptoms">{symptoms.slice(0, 4).join(', ')}{symptoms.length > 4 ? ` +${symptoms.length - 4}` : ''}</div>
                                </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div className="timeline-confidence">{Number(confidence).toFixed(1)}%</div>
                                <button
                                    className="btn btn-danger btn-sm"
                                    onClick={() => handleDelete(h._id)}
                                    disabled={deleting === h._id}
                                >
                                    {deleting === h._id ? '…' : '✕'}
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

// ==================== Wellness Hub ====================
const WellnessHub = () => {
    const [articles, setArticles] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        patientAPI.getPrevention()
            .then(r => setArticles(r.data.data || []))
            .catch(() => setArticles([
                { title: 'Healthy Lifestyle Guide', category: 'Wellness', readTime: '5 min read' },
                { title: 'Preventive Health Screenings', category: 'Prevention', readTime: '7 min read' },
            ]))
            .finally(() => setLoading(false));
    }, []);

    if (loading) return (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            {[1, 2].map(i => <div key={i} className="article-card skeleton" style={{ height: '120px' }} />)}
        </div>
    );

    return (
        <div>
            <div className="section-header">
                <div><div className="section-title">💊 Wellness & Prevention</div><div className="section-subtitle">AI-curated based on your health profile</div></div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
                {articles.map((a, i) => (
                    <div key={i} className="article-card">
                        <div className="article-category">{a.category}</div>
                        <div className="article-title">{a.title}</div>
                        <div className="article-read-time">📖 {a.readTime}</div>
                    </div>
                ))}
            </div>
        </div>
    );
};

// ==================== Dashboard Section ====================
const DashboardSection = ({ onNavigate }) => {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        patientAPI.getStats()
            .then(r => setStats(r.data))
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    if (loading) return (
        <div className="dashboard-grid">
            <div className="glass-panel skeleton" style={{ height: '140px' }} />
            <div className="glass-panel skeleton" style={{ height: '140px' }} />
            <div className="glass-panel skeleton" style={{ height: '140px' }} />
            <div className="glass-panel skeleton" style={{ gridColumn: 'span 2', height: '200px' }} />
            <div className="glass-panel skeleton" style={{ height: '200px' }} />
        </div>
    );

    return (
        <div className="dashboard-grid fade-in">
            {/* Quick Stats */}
            <div className="glass-panel stat-card">
                <div className="stat-icon">🏥</div>
                <div className="stat-info">
                    <div className="stat-value">{stats?.totalDiagnoses || 0}</div>
                    <div className="stat-label">Total Diagnoses</div>
                </div>
            </div>
            <div className="glass-panel stat-card">
                <div className="stat-icon pulse">📈</div>
                <div className="stat-info">
                    <div className="stat-value">{stats?.thisMonth || 0}</div>
                    <div className="stat-label">Checkups This Month</div>
                </div>
            </div>
            <div className="glass-panel stat-card">
                <div className="stat-icon">🏷️</div>
                <div className="stat-info">
                    <div className="stat-value" style={{ fontSize: '1rem', textTransform: 'capitalize' }}>
                        {stats?.topDisease || 'N/A'}
                    </div>
                    <div className="stat-label">Primary Concern</div>
                </div>
            </div>

            {/* Recent Activity / Health Summary */}
            <div className="glass-panel" style={{ gridColumn: 'span 2', padding: '24px' }}>
                <div className="section-title" style={{ marginBottom: '20px' }}>Latest Clinical Result</div>
                {stats?.lastDiagnosis ? (
                    <div className="latest-diag">
                        <div className="diag-main">
                            <div className="diag-disease">{stats.lastDiagnosis.disease}</div>
                            <div className="diag-confidence">{stats.lastDiagnosis.confidence.toFixed(1)}% Confidence</div>
                        </div>
                        <div className="diag-meta">
                            Detected on {new Date(stats.lastDiagnosis.date).toLocaleDateString()}
                        </div>
                        <button className="btn btn-primary btn-sm" onClick={() => onNavigate('history')} style={{ marginTop: '16px' }}>
                            View Full History →
                        </button>
                    </div>
                ) : (
                    <div style={{ color: 'var(--text-muted)' }}>No recent activity recorded.</div>
                )}
            </div>

            {/* Wellness Teaser */}
            <div className="glass-panel" style={{ padding: '24px' }}>
                <div className="section-title" style={{ marginBottom: '16px' }}>Wellness Tip</div>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                    Based on your health profile, we recommend maintaining a consistent hydration routine and tracking your symptoms daily.
                </p>
                <button className="btn btn-ghost btn-sm" onClick={() => onNavigate('wellness')} style={{ marginTop: '12px' }}>
                    Go to Wellness Hub
                </button>
            </div>
        </div>
    );
};

// ==================== Profile Section ====================
const ProfileSection = () => {
    const { user } = useAuth();
    const [profile, setProfile] = useState({
        age: '', weight: '', height: '', bloodGroup: '',
        allergies: '', medications: '', emergencyContact: ''
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [msg, setMsg] = useState('');
    const [docEmail, setDocEmail] = useState('');
    const [linking, setLinking] = useState(false);

    useEffect(() => {
        patientAPI.getProfile()
            .then(r => setProfile(prev => ({ ...prev, ...r.data.data })))
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    const linkDoctor = async () => {
        if (!docEmail) return;
        setLinking(true);
        try {
            const res = await patientAPI.linkDoctor(docEmail);
            setMsg(res.data.message);
            // Refresh profile to get assigned doctor
            patientAPI.getProfile().then(r => {
                setProfile(prev => ({ ...prev, ...r.data.data }));
                setDocEmail('');
            });
        } catch (err) {
            setMsg(err.response?.data?.message || 'Error linking doctor.');
        } finally {
            setLinking(false);
        }
    };

    const unlinkDoctor = async () => {
        if (!window.confirm('Are you sure you want to unlink your doctor?')) return;
        setLinking(true);
        try {
            await patientAPI.unlinkDoctor();
            setMsg('Doctor unlinked successfully.');
            // Refresh
            patientAPI.getProfile().then(r => setProfile(prev => ({ ...prev, ...r.data.data })));
        } catch {
            setMsg('Error unlinking doctor.');
        } finally {
            setLinking(false);
        }
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            await patientAPI.saveProfile(profile);
            setMsg('Profile updated successfully!');
            setTimeout(() => setMsg(''), 3000);
        } catch {
            setMsg('Error updating profile.');
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="empty-state"><span className="spinner" /></div>;

    return (
        <div className="glass-panel slide-up" style={{ padding: '30px', maxWidth: '800px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '30px' }}>
                <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'linear-gradient(135deg, #6366f1, #10b981)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem' }}>
                    {user?.name?.[0] || 'P'}
                </div>
                <div>
                    <h2 style={{ margin: 0 }}>{user?.name || 'Patient'}</h2>
                    <p style={{ color: 'var(--text-muted)', margin: '4px 0 0' }}>{user?.email} · Patient ID: {user?.id?.slice(-6)}</p>
                </div>
            </div>

            <form onSubmit={handleSave} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div className="form-group">
                    <label>Age</label>
                    <input 
                        type="number" 
                        className="form-input" 
                        min="0" 
                        max="120" 
                        step="1"
                        placeholder="e.g. 25"
                        value={profile.age || ''} 
                        onChange={e => setProfile({...profile, age: e.target.value})} 
                    />
                </div>
                <div className="form-group">
                    <label>Weight (kg)</label>
                    <input 
                        type="number" 
                        className="form-input" 
                        min="1" 
                        max="600" 
                        step="0.1"
                        placeholder="e.g. 70.5"
                        value={profile.weight || ''} 
                        onChange={e => setProfile({...profile, weight: e.target.value})} 
                    />
                </div>
                <div className="form-group">
                    <label>Height (cm)</label>
                    <input 
                        type="number" 
                        className="form-input" 
                        min="10" 
                        max="300" 
                        step="0.1"
                        placeholder="e.g. 175"
                        value={profile.height || ''} 
                        onChange={e => setProfile({...profile, height: e.target.value})} 
                    />
                </div>
                <div className="form-group">
                    <label>Blood Group</label>
                    <select className="form-input" value={profile.bloodGroup || ''} onChange={e => setProfile({...profile, bloodGroup: e.target.value})}>
                        <option value="">Select</option>
                        {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(bg => <option key={bg} value={bg}>{bg}</option>)}
                    </select>
                </div>
                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                    <label>Allergies</label>
                    <textarea className="form-input" rows="2" value={profile.allergies || ''} onChange={e => setProfile({...profile, allergies: e.target.value})} placeholder="e.g. Penicillin, Peanuts" />
                </div>
                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                    <label>Current Medications</label>
                    <textarea className="form-input" rows="2" value={profile.medications || ''} onChange={e => setProfile({...profile, medications: e.target.value})} placeholder="e.g. Lisinopril 10mg" />
                </div>
                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                    <label>Emergency Contact</label>
                    <input className="form-input" value={profile.emergencyContact || ''} onChange={e => setProfile({...profile, emergencyContact: e.target.value})} placeholder="Name · Phone Number" />
                </div>
                
                <div style={{ gridColumn: 'span 2', display: 'flex', alignItems: 'center', gap: '16px', marginTop: '10px' }}>
                    <button type="submit" className="btn btn-primary" disabled={saving}>
                        {saving ? 'Saving...' : 'Save General Health Profile'}
                    </button>
                    {msg && <span style={{ color: msg.includes('Error') ? 'var(--danger)' : '#10b981', fontSize: '0.9rem', fontWeight: 600 }}>{msg}</span>}
                </div>
            </form>

            {/* Medical Team Section */}
            <div style={{ marginTop: '40px', borderTop: '1px solid var(--border)', paddingTop: '30px' }}>
                <div className="section-title" style={{ fontSize: '1.2rem', marginBottom: '20px' }}>🏥 Your Medical Team</div>
                
                {profile.assignedDoctor ? (
                    <div className="glass-panel" style={{ padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderLeft: '4px solid var(--accent)' }}>
                        <div>
                            <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>Dr. Linked Clinician</div>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Primary AI Health Monitor</div>
                        </div>
                        <button className="btn btn-ghost btn-sm" onClick={unlinkDoctor} disabled={linking}>
                            {linking ? '...' : 'Unlink Doctor'}
                        </button>
                    </div>
                ) : (
                    <div className="glass-panel" style={{ padding: '20px' }}>
                        <div style={{ marginBottom: '15px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                            Link with a doctor to share your diagnostic history and receive clinical feedback in real-time.
                        </div>
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <input 
                                className="form-input" 
                                placeholder="Enter Doctor's Email..." 
                                value={docEmail}
                                onChange={e => setDocEmail(e.target.value)}
                                style={{ flex: 1 }}
                            />
                            <button className="btn btn-accent" onClick={linkDoctor} disabled={linking || !docEmail}>
                                {linking ? 'Linking...' : 'Link Doctor'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

// ==================== Patient Portal Shell ====================
const PatientPortal = () => {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState('dashboard');
    const [result, setResult] = useState(null);

    const handleResult = (data) => {
        setResult(data);
        setActiveTab('results');
    };

    const tabs = [
        { id: 'dashboard', icon: '📊', label: 'Dashboard' },
        { id: 'diagnose', icon: '🧬', label: 'Diagnose AI' },
        { id: 'results', icon: '📝', label: 'Live Result', disabled: !result },
        { id: 'history', icon: '📜', label: 'Timeline' },
        { id: 'wellness', icon: '💊', label: 'Wellness' },
        { id: 'profile', icon: '👤', label: 'Profile' }
    ];

    return (
        <div className="portal-layout">
            <aside className="portal-sidebar">
                <div className="sidebar-section-label">Patient Tools</div>
                {tabs.map(t => (
                    <button
                        key={t.id}
                        className={`sidebar-btn ${activeTab === t.id ? 'active' : ''}`}
                        onClick={() => !t.disabled && setActiveTab(t.id)}
                        disabled={t.disabled}
                        style={t.disabled ? { opacity: 0.4 } : {}}
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
                            Welcome, {user?.name || 'Patient'} · {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                        </div>
                    </div>
                    {result && activeTab === 'results' && (
                        <button className="btn btn-ghost btn-sm" onClick={() => { setResult(null); setActiveTab('diagnose'); }}>
                            ← New Diagnosis
                        </button>
                    )}
                </div>

                {activeTab === 'dashboard' && <DashboardSection onNavigate={setActiveTab} />}
                {activeTab === 'diagnose' && <SymptomEngine onResult={handleResult} />}
                {activeTab === 'results' && result && <DiagnosisResult result={result} onReset={() => { setResult(null); setActiveTab('diagnose'); }} />}
                {activeTab === 'history' && <HistorySection />}
                {activeTab === 'wellness' && <WellnessHub />}
                {activeTab === 'profile' && <ProfileSection />}
            </div>
        </div>
    );
};

export default PatientPortal;
