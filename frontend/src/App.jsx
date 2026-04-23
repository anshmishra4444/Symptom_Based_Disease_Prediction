import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import './App.css';

import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import ChatBot from './components/ChatBot';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import PatientPortal from './pages/PatientPortal';
import DoctorPortal from './pages/DoctorPortal';

// Background Assets
import doctorBg from './assets/bg/doctor.png';
import labBg from './assets/bg/lab.png';
import dashboardBg from './assets/bg/dashboard.png';
import wellnessBg from './assets/bg/wellness.png';
import xrayBg from './assets/bg/xray.png';


// ==================== Navbar ====================
const Navbar = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    const isLanding = location.pathname === '/';

    const handleLogout = () => {
        logout();
        navigate('/');
    };

    const initials = user?.name
        ? user.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
        : '?';

    return (
        <nav className="navbar">
            <div className="nav-brand" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
                <div className="nav-logo">⚕️</div>
                <span className="nav-brand-name">VITA-CORE</span>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginLeft: '4px', fontWeight: 500 }}>2.0</span>
            </div>

            <div className="nav-links">
                {!user && !isLanding && (
                    <>
                        <span className="nav-link" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>Home</span>
                        <span className="nav-link" onClick={() => navigate('/login')} style={{ cursor: 'pointer' }}>Sign In</span>
                    </>
                )}

                {user && (
                    <>
                        {user.role === 'doctor' ? (
                            <span
                                className={`nav-link ${location.pathname === '/doctor' ? 'active' : ''}`}
                                onClick={() => navigate('/doctor')}
                                style={{ cursor: 'pointer' }}
                            >
                                🩺 Clinician
                            </span>
                        ) : (
                            <span
                                className={`nav-link ${location.pathname === '/patient' ? 'active' : ''}`}
                                onClick={() => navigate('/patient')}
                                style={{ cursor: 'pointer' }}
                            >
                                🧬 Patient
                            </span>
                        )}
                    </>
                )}
            </div>

            {user && (
                <div className="nav-user">
                    <div className="nav-avatar">{initials}</div>
                    <span className="nav-username">{user.name}</span>
                    <button className="btn btn-ghost btn-sm" onClick={handleLogout}>Sign out</button>
                </div>
            )}

            {!user && isLanding && (
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => navigate('/login')}>Sign In</button>
                    <button className="btn btn-primary btn-sm" onClick={() => navigate('/register')}>Get Started</button>
                </div>
            )}
        </nav>
    );
};

// ==================== Protected Route ====================
const ProtectedRoute = ({ children, role }) => {
    const { user, loading } = useAuth();

    if (loading) return (
        <div className="loading-screen">
            <div className="spinner" />
            <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Loading…</div>
        </div>
    );

    if (!user) return <Navigate to="/login" replace />;
    if (role && user.role !== role) return <Navigate to={user.role === 'doctor' ? '/doctor' : '/patient'} replace />;

    return children;
};

// ==================== Public-Only Route (redirect if logged in) ====================
const PublicRoute = ({ children }) => {
    const { user, loading } = useAuth();

    if (loading) return (
        <div className="loading-screen">
            <div className="spinner" />
        </div>
    );

    if (user) return <Navigate to={user.role === 'doctor' ? '/doctor' : '/patient'} replace />;
    return children;
};

const AppShell = () => (
    <>
        <div className="aurora-bg" />
        <div className="bg-decorations">
            <div className="bg-img-item bg-img-1"><img src={doctorBg} alt="" /></div>
            <div className="bg-img-item bg-img-2"><img src={labBg} alt="" /></div>
            <div className="bg-img-item bg-img-3"><img src={dashboardBg} alt="" /></div>
            <div className="bg-img-item bg-img-4"><img src={wellnessBg} alt="" /></div>
            <div className="bg-img-item bg-img-5"><img src={xrayBg} alt="" /></div>
        </div>
        <div className="app">
            <Navbar />
            <main className="main-content">
                <Routes>
                    {/* Public Routes */}
                    <Route path="/" element={<Landing />} />
                    <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
                    <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />

                    {/* Protected routes */}
                    <Route path="/patient" element={<ProtectedRoute role="patient"><PatientPortal /></ProtectedRoute>} />
                    <Route path="/doctor" element={<ProtectedRoute role="doctor"><DoctorPortal /></ProtectedRoute>} />

                    {/* Legacy redirects */}
                    <Route path="/patient-portal" element={<Navigate to="/patient" replace />} />
                    <Route path="/doctor-portal" element={<Navigate to="/doctor" replace />} />
                    
                    {/* Fallback */}
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </main>
            <ChatBot />
        </div>
    </>
);


// ==================== Root ====================
function App() {
    return (
        <AuthProvider>
            <SocketProvider>
                <BrowserRouter>
                    <AppShell />
                </BrowserRouter>
            </SocketProvider>
        </AuthProvider>
    );
}

export default App;
