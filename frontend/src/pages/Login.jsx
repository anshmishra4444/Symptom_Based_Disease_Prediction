import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const role = new URLSearchParams(location.search).get('role') || 'patient';

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const user = await login(email, password);
            navigate(user.role === 'doctor' ? '/doctor' : '/patient');
        } catch (err) {
            setError(err.response?.data?.message || 'Login failed. Check your credentials.');
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
                <h1 className="auth-title">Welcome back</h1>
                <p className="auth-subtitle">
                    Sign in to your {role === 'doctor' ? 'Clinician' : 'Patient'} Portal
                </p>

                {error && (
                    <div className="alert alert-error" style={{ marginBottom: '20px' }}>
                        ⚠️ {error}
                    </div>
                )}

                <form className="auth-form" onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label className="form-label">Email Address</label>
                        <input
                            className="form-input"
                            type="email"
                            placeholder="you@example.com"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            required
                            autoComplete="email"
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Password</label>
                        <input
                            className="form-input"
                            type="password"
                            placeholder="••••••••"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            required
                            minLength={6}
                            autoComplete="current-password"
                        />
                    </div>
                    <button
                        type="submit"
                        className={`btn ${role === 'doctor' ? 'btn-accent' : 'btn-primary'} btn-full`}
                        style={{ marginTop: '8px' }}
                        disabled={loading}
                    >
                        {loading ? (
                            <><span className="spinner spinner-sm" /> Signing in…</>
                        ) : 'Sign In'}
                    </button>
                </form>

                <div className="auth-footer">
                    No account?{' '}
                    <Link to={`/register?role=${role}`}>Create one free →</Link>
                </div>
            </div>
        </div>
    );
};

export default Login;
