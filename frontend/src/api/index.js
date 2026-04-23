import axios from 'axios';

const BASE_URL = 'http://localhost:5000/api';

const api = axios.create({ baseURL: BASE_URL });

api.interceptors.request.use(config => {
    const token = localStorage.getItem('token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

api.interceptors.response.use(
    res => res,
    err => {
        if (err.response?.status === 401) {
            localStorage.removeItem('token');
            window.location.href = '/login';
        }
        return Promise.reject(err);
    }
);

// ==================== Auth ====================
export const authAPI = {
    register: (data) => api.post('/auth/register', data),
    login: (data) => api.post('/auth/login', data),
    me: () => api.get('/auth/me'),
};

// ==================== Symptoms & Prediction ====================
export const mlAPI = {
    getSymptoms: () => api.get('/symptoms'),
    extract: (payload) => api.post('/extract', payload),
    predict: (symptoms) => api.post('/predict', { symptoms }),
    translate: (text, targetLanguage) => api.post('/translate', { text, targetLanguage }),
    chat: (message, systemPrompt) => api.post('/chat', { message, systemPrompt }),
    featureImportance: () => api.get('/feature-importance'),
};

// ==================== History ====================
export const historyAPI = {
    getAll: () => api.get('/history'),
    getById: (id) => api.get(`/history/${id}`),
    deleteById: (id) => api.delete(`/history/${id}`),
};

// ==================== Stats ====================
export const statsAPI = {
    getUserStats: () => api.get('/stats'),
};

// ==================== Patient ====================
export const patientAPI = {
    getStats: () => api.get('/patient/stats'),
    getPrevention: () => api.get('/patient/prevention'),
    getProfile: () => api.get('/patient/profile'),
    saveProfile: (data) => api.post('/patient/profile', data),
    linkDoctor: (email) => api.post('/patient/link-doctor', { email }),
    unlinkDoctor: () => api.post('/patient/unlink-doctor'),
};

// ==================== Doctor ====================
export const doctorAPI = {
    getCohort: () => api.get('/doctor/cohort'),
    getAlerts: () => api.get('/doctor/alerts'),
    getPatients: (search = '', page = 1, cohortOnly = false) => api.get(`/doctor/patients?search=${search}&page=${page}&cohortOnly=${cohortOnly}`),
    getPatient: (id) => api.get(`/doctor/patient/${id}`),
    getStats: () => api.get('/doctor/stats'),
};

// ==================== Chatbot ====================
export const chatbotAPI = {
    send: (messages) => api.post('/chat/assistant', { messages }),
};

// ==================== System ====================
export const systemAPI = {
    health: () => api.get('/health'),
};

export default api;
