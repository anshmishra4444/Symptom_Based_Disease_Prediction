import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// Mirrors the backend DOMAIN_TYPO_MAP for instant client-side feedback.
// Keeping this in sync avoids a network round-trip for common typos.
const DOMAIN_TYPO_MAP = {
    'gmai.com': 'gmail.com', 'gmial.com': 'gmail.com', 'gmal.com': 'gmail.com',
    'gamil.com': 'gmail.com', 'gmail.co': 'gmail.com', 'gnail.com': 'gmail.com',
    'gmali.com': 'gmail.com', 'gmaill.com': 'gmail.com', 'gmil.com': 'gmail.com',
    'yaho.com': 'yahoo.com', 'yahooo.com': 'yahoo.com', 'yhoo.com': 'yahoo.com',
    'yahoo.co': 'yahoo.com', 'yaoo.com': 'yahoo.com',
    'outllook.com': 'outlook.com', 'outlok.com': 'outlook.com', 'outook.com': 'outlook.com',
    'hotmial.com': 'hotmail.com', 'hotmal.com': 'hotmail.com', 'hotmai.com': 'hotmail.com',
    'icoud.com': 'icloud.com', 'iclod.com': 'icloud.com',
    'redifmail.com': 'rediffmail.com', 'reddiffmail.com': 'rediffmail.com',
};

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

// Returns { valid, message?, suggestion? }
const validateEmail = (email) => {
    if (!email) return { valid: true }; // Don't show error on empty (required handles it)
    if (!EMAIL_REGEX.test(email)) {
        return { valid: false, message: 'Please enter a valid email address.' };
    }
    const domain = email.split('@')[1]?.toLowerCase();
    if (domain && DOMAIN_TYPO_MAP[domain]) {
        const corrected = `${email.split('@')[0]}@${DOMAIN_TYPO_MAP[domain]}`;
        return { valid: false, message: `Did you mean "${corrected}"?`, suggestion: corrected };
    }
    return { valid: true };
};

// Password strength: returns { score: 0-4, label, checks }
const getPasswordStrength = (pw) => {
    const checks = {
        length: pw.length >= 8,
        upper: /[A-Z]/.test(pw),
        lower: /[a-z]/.test(pw),
        number: /[0-9]/.test(pw),
        special: /[!@#$%^&*(),.?":{}|<>]/.test(pw),
    };
    const score = Object.values(checks).filter(Boolean).length;
    const labels = ['Very Weak', 'Weak', 'Fair', 'Good', 'Strong'];
    const colors = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#10b981'];
    return { score, label: labels[score - 1] || '', color: colors[score - 1] || '#444', checks };
};

const Register = () => {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [emailStatus, setEmailStatus] = useState({ valid: true });
    const [pwStrength, setPwStrength] = useState({ score: 0, label: '', color: '#444', checks: {} });
    const { register } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const role = new URLSearchParams(location.search).get('role') || 'patient';

    // Real-time email validation (debounced 400ms)
    useEffect(() => {
        if (!email) { setEmailStatus({ valid: true }); return; }
        const timer = setTimeout(() => {
            setEmailStatus(validateEmail(email));
        }, 400);
        return () => clearTimeout(timer);
    }, [email]);

    // Real-time password strength
    useEffect(() => {
        setPwStrength(getPasswordStrength(password));
    }, [password]);

    // Accept a typo suggestion with one click
    const acceptSuggestion = useCallback(() => {
        if (emailStatus.suggestion) {
            setEmail(emailStatus.suggestion);
            setEmailStatus({ valid: true });
        }
    }, [emailStatus]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        // Final validation gate
        const emailCheck = validateEmail(email);
        if (!emailCheck.valid) {
            setError(emailCheck.message);
            return;
        }

        if (pwStrength.score < 5) {
            const missing = [];
            if (!pwStrength.checks.length)  missing.push('8+ characters');
            if (!pwStrength.checks.upper)   missing.push('uppercase letter');
            if (!pwStrength.checks.lower)   missing.push('lowercase letter');
            if (!pwStrength.checks.number)  missing.push('number');
            if (!pwStrength.checks.special) missing.push('special character');
            setError(`Password needs: ${missing.join(', ')}.`);
            return;
        }

        setLoading(true);
        try {
            const user = await register(email, password, name, role);
            navigate(user.role === 'doctor' ? '/doctor' : '/patient');
        } catch (err) {
            setError(err.response?.data?.message || 'Registration failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-page">
            <div className="auth-card slide-up">
                <div className="auth-logo">
                    {role === 'doctor' ? '🩺' : '🧬'}
                </div>
                <h1 className="auth-title">Create account</h1>
                <p className="auth-subtitle">
                    Join as a {role === 'doctor' ? 'Clinician' : 'Patient'} — free forever
                </p>

                {error && (
                    <div className="alert alert-error" style={{ marginBottom: '20px' }}>
                        {error}
                    </div>
                )}

                <form className="auth-form" onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label className="form-label">Full Name</label>
                        <input
                            id="register-name"
                            className="form-input"
                            type="text"
                            placeholder="Dr. Jane Smith"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            required
                            autoComplete="name"
                        />
                    </div>

                    {/* Email with real-time validation */}
                    <div className="form-group">
                        <label className="form-label">Email Address</label>
                        <input
                            id="register-email"
                            className="form-input"
                            type="email"
                            placeholder="you@example.com"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            required
                            autoComplete="email"
                            style={{
                                borderColor: email && !emailStatus.valid ? '#ef4444' : undefined,
                                boxShadow: email && !emailStatus.valid ? '0 0 0 2px rgba(239,68,68,0.15)' : undefined,
                            }}
                        />
                        {email && !emailStatus.valid && (
                            <div style={{
                                marginTop: '6px', fontSize: '0.78rem', color: '#f97316',
                                display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap',
                            }}>
                                <span>{emailStatus.message}</span>
                                {emailStatus.suggestion && (
                                    <button
                                        type="button"
                                        onClick={acceptSuggestion}
                                        style={{
                                            background: 'rgba(99,102,241,0.15)',
                                            border: '1px solid rgba(99,102,241,0.3)',
                                            borderRadius: '6px',
                                            padding: '2px 8px',
                                            fontSize: '0.75rem',
                                            color: '#818cf8',
                                            cursor: 'pointer',
                                            transition: 'background 0.2s',
                                        }}
                                    >
                                        Use {emailStatus.suggestion.split('@')[1]}
                                    </button>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Password with strength meter */}
                    <div className="form-group">
                        <label className="form-label">Password</label>
                        <input
                            id="register-password"
                            className="form-input"
                            type="password"
                            placeholder="Min. 8 chars (Upper, lower, #, !)"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            required
                            minLength={8}
                            autoComplete="new-password"
                        />
                        {/* Strength bar */}
                        {password && (
                            <div style={{ marginTop: '8px' }}>
                                <div style={{
                                    display: 'flex', gap: '3px', marginBottom: '4px',
                                }}>
                                    {[1, 2, 3, 4, 5].map(i => (
                                        <div key={i} style={{
                                            flex: 1, height: '4px', borderRadius: '2px',
                                            background: i <= pwStrength.score ? pwStrength.color : 'rgba(255,255,255,0.08)',
                                            transition: 'background 0.3s ease',
                                        }} />
                                    ))}
                                </div>
                                <div style={{
                                    fontSize: '0.72rem', color: pwStrength.color,
                                    display: 'flex', justifyContent: 'space-between',
                                }}>
                                    <span>{pwStrength.label}</span>
                                    <span style={{ color: 'var(--text-muted)' }}>
                                        {pwStrength.score}/5
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>

                    <button
                        type="submit"
                        className={`btn ${role === 'doctor' ? 'btn-accent' : 'btn-primary'} btn-full`}
                        style={{ marginTop: '8px' }}
                        disabled={loading || (email && !emailStatus.valid)}
                    >
                        {loading ? (
                            <><span className="spinner spinner-sm" /> Creating account…</>
                        ) : 'Create Account'}
                    </button>
                </form>

                <div className="auth-footer">
                    Already have an account?{' '}
                    <Link to={`/login?role=${role}`}>Sign in →</Link>
                </div>
            </div>
        </div>
    );
};

export default Register;
