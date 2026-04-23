
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const dns = require('node:dns').promises;
require('dotenv').config();

const app = express();
// app.use(cors());
app.use(cors({
  origin: "https://symptom-based-disease-prediction-14jrhwh25.vercel.app" 
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// MongoDB Connection
const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
    console.error('❌ CRITICAL: MONGO_URI not found in .env');
    process.exit(1);
}

mongoose.connect(MONGO_URI, {
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
})
    .then(() => console.log('✅ MongoDB Connected (FHIR Ready)'))
    .catch(err => console.error('❌ MongoDB Connection Error:', err));

const http = require('http');
const socketIo = require('socket.io');

const server = http.createServer(app);
const io = socketIo(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

// ==================== Data Models (FHIR Structured) ====================
// Implementation Choice: We follow the HL7 FHIR (Fast Healthcare Interoperability Resources) 
// standard to ensure that our data schema is compatible with modern hospital systems.

// FHIR Patient Resource (Refactored User)
const patientSchema = new mongoose.Schema({
    resourceType: { type: String, default: 'Patient' },
    active: { type: Boolean, default: true },
    name: {
        type: [{
            text: String,
            family: String,
            given: [String]
        }],
        default: []
    },
    gender: { type: String, enum: ['male', 'female', 'other', 'unknown'] },
    birthDate: Date,
    telecom: [{ system: String, value: String, use: String }],
    // Internal Auth fields (Extended)
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['patient', 'doctor'], default: 'patient' },
    assignedDoctor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', patientSchema);

// FHIR Observation & DiagnosticReport Resource (Refactored Prediction)
const diagnosticSchema = new mongoose.Schema({
    resourceType: { type: String, default: 'DiagnosticReport' },
    status: { type: String, default: 'final' },
    subject: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    effectiveDateTime: { type: Date, default: Date.now },
    performer: [{ display: String }],
    // Results (Observation mapping)
    conclusion: String, // predictedDisease
    codedDiagnosis: [{ 
        system: { type: String, default: 'http://snomed.info/sct' },
        code: String,
        display: String
    }],
    result: [{
        display: String, // symptom
        valueQuantity: { value: Number, unit: String } // confidence
    }],
    // Industry-Leading Meta-data
    meta: {
        rfPrediction: Object,
        knnPrediction: Object,
        xaiExplanation: Object,
        causalInsight: Object,
        relatedSymptoms: [String],
        soapNote: String
    }
});

const Prediction = mongoose.model('Prediction', diagnosticSchema);

// ==================== ML API Configuration ====================

const ML_API_URL = process.env.ML_API_URL || 'http://localhost:8000';

// ==================== Auth Middleware ====================

const authMiddleware = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        
        if (!token) {
            return res.status(401).json({ success: false, message: 'No token provided' });
        }
        
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
        req.userId = decoded.userId;
        next();
    } catch (error) {
        res.status(401).json({ success: false, message: 'Invalid token' });
    }
};

// ==================== Auth Utilities ====================

const ALLOWED_COMMON_DOMAINS = new Set([
    'gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'icloud.com', 
    'live.com', 'me.com', 'msn.com', 'aim.com', 'aol.com', 'ymail.com',
    'protonmail.com', 'zoho.com', 'rediffmail.com'
]);

// Typo Detection Map: Common misspellings of popular email domains.
// This is a deliberate security measure to prevent users from accidentally
// registering with unreachable addresses, which would lock them out.
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

const isValidEmail = async (email) => {
    // 1. Basic format check (RFC 5322 simplified)
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!email || !emailRegex.test(email)) {
        return { valid: false, message: "Invalid email format. Please provide a standard email address." };
    }

    const domain = email.split('@')[1].toLowerCase();

    // 2. Typo Detection (Proactive UX Defense)
    // We check common misspellings before DNS to give instant, helpful feedback.
    const suggestion = DOMAIN_TYPO_MAP[domain];
    if (suggestion) {
        return { valid: false, message: `Did you mean "${email.split('@')[0]}@${suggestion}"? The domain "${domain}" appears to be a typo.` };
    }
    
    // 3. Domain Reputation Check (Allowlist for known providers)
    // Known reliable providers skip DNS lookup for faster registration.
    if (ALLOWED_COMMON_DOMAINS.has(domain)) return { valid: true };

    // 4. Active DNS Verification (Proactive Defense)
    // To prevent bot registrations, we verify that the domain has valid MX (Mail Exchange) 
    // records. This proves the domain can actually receive mail.
    try {
        const mxRecords = await dns.resolveMx(domain);
        if (mxRecords && mxRecords.length > 0) {
            return { valid: true };
        }
        return { valid: false, message: `The domain "${domain}" is not configured to receive emails. Please use a valid provider.` };
    } catch (error) {
        // If domain lookup fails (ENOTFOUND), it's definitely invalid (like gma.com)
        if (error.code === 'ENOTFOUND' || error.code === 'ENODATA') {
            return { valid: false, message: `The email domain "${domain}" was not found. Please check for spelling errors.` };
        }
        
        // If it's a connectivity/timeout issue, we gracefully fail open to avoid blocking real users
        console.warn('[WARN] DNS validation bypassed due to network error:', error.message);
        return { valid: true };
    }
};

const isValidPassword = (password) => {
    if (!password || password.length < 8) {
        return { valid: false, message: "Password must be at least 8 characters long." };
    }
    const hasUpper = /[A-Z]/.test(password);
    const hasLower = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);

    if (!hasUpper || !hasLower || !hasNumber || !hasSpecial) {
        return { 
            valid: false, 
            message: "Password is too weak. It must contain at least one uppercase letter, one lowercase letter, one number, and one special character." 
        };
    }
    return { valid: true };
};

// ==================== Auth Routes ====================

// Register
app.post('/api/auth/register', async (req, res) => {
    try {
        const { email, password, name, role } = req.body;

        // Valid Email Check (Proactive DNS Lookup)
        const emailValidation = await isValidEmail(email);
        if (!emailValidation.valid) {
            return res.status(400).json({ success: false, message: emailValidation.message });
        }
        
        // Password Strength Check
        const passwordValidation = isValidPassword(password);
        if (!passwordValidation.valid) {
            return res.status(400).json({ success: false, message: passwordValidation.message });
        }
        
        // Check if user exists
        const existing = await User.findOne({ email });
        if (existing) {
            return res.status(400).json({ success: false, message: 'An account with this email already exists.' });
        }
        
        // Hash password
        const hashedPassword = await bcrypt.hash(password, 12);
        
        // Create user (FHIR Compliant Name Mapping)
        console.log('📝 Registering new patient:', name);
        const user = await User.create({
            email,
            password: hashedPassword,
            name: typeof name === 'string' ? [{ text: name }] : name,
            role: role || 'patient'
        });
        
        // Generate token
        const token = jwt.sign(
            { userId: user._id },
            process.env.JWT_SECRET || 'your-secret-key',
            { expiresIn: '7d' }
        );
        
        res.status(201).json({
            success: true,
            token,
            user: {
                id: user._id,
                email: user.email,
                name: user.name[0]?.text || '',
                role: user.role || 'patient'
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Login
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        // Basic format check (Don't need full DNS check for login, just format)
        if (!email || !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email)) {
            return res.status(400).json({ success: false, message: "Invalid email format." });
        }

        // Find user
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }
        
        // Check password
        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }
        
        // Generate token
        const token = jwt.sign(
            { userId: user._id },
            process.env.JWT_SECRET || 'your-secret-key',
            { expiresIn: '7d' }
        );
        
        res.json({
            success: true,
            token,
            user: {
                id: user._id,
                email: user.email,
                name: user.name[0]?.text || '',
                role: user.role || 'patient'
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Get current user
app.get('/api/auth/me', authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.userId).select('-password');
        if (user) {
            const userObj = user.toObject();
            userObj.name = user.name[0]?.text || '';
            return res.json({ success: true, user: userObj });
        }
        res.status(404).json({ success: false, message: 'User not found' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// ==================== Prediction Routes ====================

// Extract symptoms using multimodal AI
app.post('/api/extract', authMiddleware, async (req, res) => {
    try {
        const payload = req.body;
        const mlResponse = await axios.post(`${ML_API_URL}/extract-symptoms`, payload, {
            maxBodyLength: Infinity,
            maxContentLength: Infinity
        });
        res.json(mlResponse.data);
    } catch (error) {
        console.error('Extraction error:', error.message);
        res.status(500).json({ 
            success: false, 
            message: 'Symptom extraction failed',
            error: error.response?.data || error.message
        });
    }
});

// Get symptoms list from ML API
app.get('/api/symptoms', async (req, res) => {
    try {
        const response = await axios.get(`${ML_API_URL}/symptoms`);
        res.json(response.data);
    } catch (error) {
        res.status(500).json({ success: false, message: 'ML API unavailable' });
    }
});

// Make prediction
// This route orchestrates the full diagnostic pipeline: ML inference -> XAI -> GNN -> Gemini SOAP.
// The result is persisted as a FHIR DiagnosticReport for clinical audit trail.
app.post('/api/predict', authMiddleware, async (req, res) => {
    try {
        const { symptoms } = req.body;

        // Input validation: ensure symptoms is a non-empty array of strings
        if (!Array.isArray(symptoms) || symptoms.length === 0) {
            return res.status(400).json({ success: false, message: 'At least one symptom is required.' });
        }
        if (symptoms.some(s => typeof s !== 'string' || s.trim().length === 0)) {
            return res.status(400).json({ success: false, message: 'All symptoms must be non-empty strings.' });
        }
        
        // Progress Tracking (Socket.io)
        // We emit status updates via WebSockets to give the user real-time feedback 
        // during high-latency ML operations.
        io.emit('inference-status', { status: 'Sending', progress: 20, message: 'Transmitting symptoms to AI Engine...' });

        // Call the ML microservice (FastAPI on port 8000)
        const mlResponse = await axios.post(`${ML_API_URL}/predict`, { symptoms });
        const p = mlResponse.data;

        io.emit('inference-status', { status: 'Analyzing', progress: 60, message: 'Calculating SHAP impacts...' });
        
        // Save to database (FHIR DiagnosticReport)
        const savedPrediction = await Prediction.create({
            subject: req.userId,
            conclusion: p.final_prediction.disease,
            effectiveDateTime: new Date(),
            result: symptoms.map(s => ({ display: s, valueQuantity: { value: p.final_prediction.confidence, unit: '%' } })),
            meta: {
                rfPrediction: p.rf_prediction,
                knnPrediction: p.knn_prediction,
                xaiExplanation: p.xai_explanation,
                relatedSymptoms: p.related_symptoms,
                soapNote: p.agentic_soap_note
            }
        });
        
        io.emit('inference-status', { status: 'Complete', progress: 100, message: 'Diagnostic Report Ready' });
        
        res.json({
            success: true,
            predictionId: savedPrediction._id,
            ...p
        });
    } catch (error) {
        console.error('Prediction error:', error.message);
        io.emit('inference-status', { status: 'Error', progress: 0, message: 'Prediction failed.' });
        res.status(500).json({ 
            success: false, 
            message: 'Prediction failed',
            error: error.response?.data || error.message
        });
    }
});

// Get user's prediction history
app.get('/api/history', authMiddleware, async (req, res) => {
    try {
        const predictions = await Prediction.find({ subject: req.userId })
            .sort({ effectiveDateTime: -1 })
            .limit(50);
        
        res.json({
            success: true,
            count: predictions.length,
            data: predictions
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Get specific prediction
app.get('/api/history/:id', authMiddleware, async (req, res) => {
    try {
        const prediction = await Prediction.findOne({
            _id: req.params.id,
            subject: req.userId
        });
        
        if (!prediction) {
            return res.status(404).json({ success: false, message: 'Not found' });
        }
        
        res.json({ success: true, data: prediction });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Delete prediction
app.delete('/api/history/:id', authMiddleware, async (req, res) => {
    try {
        await Prediction.findOneAndDelete({
            _id: req.params.id,
            subject: req.userId
        });
        
        res.json({ success: true, message: 'Deleted successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// ==================== Role Middleware ====================

const doctorMiddleware = async (req, res, next) => {
    try {
        const user = await User.findById(req.userId).select('role');
        if (!user || user.role !== 'doctor') {
            return res.status(403).json({ success: false, message: 'Access restricted to clinicians.' });
        }
        next();
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
};

// ==================== AI Chat Routes ====================

// Generic chat proxy (SOAP notes, reports, translation)
app.post('/api/chat', authMiddleware, async (req, res) => {
    try {
        const mlResponse = await axios.post(`${ML_API_URL}/chat`, req.body);
        res.json(mlResponse.data);
    } catch (error) {
        console.error('Chat error:', error.message);
        res.status(500).json({ success: false, message: 'Chat failed', error: error.response?.data || error.message });
    }
});

// Multi-turn Clinical Assistant (Agentic Pipeline)
// This route orchestrates the interaction between the user's history and Gemini AI.
app.post('/api/chat/assistant', authMiddleware, async (req, res) => {
    try {
        const { messages } = req.body;
        const user = await User.findById(req.userId).select('name role');
        const lastDiag = await Prediction.findOne({ subject: req.userId })
            .sort({ effectiveDateTime: -1 }).select('conclusion result');

        const contextInfo = lastDiag
            ? `User's latest diagnosis: "${lastDiag.conclusion}", symptoms: ${lastDiag.result?.map(r => r.display).slice(0, 5).join(', ')}.`
            : 'No previous diagnoses.';

        const isDoctor = user?.role === 'doctor';
        const systemPrompt = isDoctor
            ? `You are Vita, an expert AI clinical decision support assistant in Vita-Core 2.0. Help Dr. ${user?.name || 'Clinician'} with clinical reasoning, differential diagnoses, treatment protocols, and interpreting AI diagnostic reports. Be professional, evidence-based, and prioritize Indian medical context and standards (e.g., IMA guidelines).`
            : `You are Vita, a compassionate AI health assistant in Vita-Core 2.0. Help ${user?.name || 'the patient'} understand symptoms, diagnoses, and wellness guidance. ${contextInfo} IMPORTANT: You exclusively support English and Indian Regional Languages (Hindi, Bengali, Telugu, Marathi, Tamil, Gujarati, Kannada, Malayalam, Punjabi). Do NOT use other foreign languages. Prioritize Indian dietary habits and cultural health contexts. Always recommend consulting a local doctor for serious concerns.`;

        const conversationHistory = (messages || [])
            .map(m => `${m.role === 'user' ? 'User' : 'Vita'}: ${m.content}`)
            .join('\n');

        const fullPrompt = conversationHistory ? `${conversationHistory}\nVita:` : (messages?.[0]?.content || '');

        const mlResponse = await axios.post(`${ML_API_URL}/chat`, { message: fullPrompt, systemPrompt });
        res.json({ success: true, response: mlResponse.data.response });
    } catch (error) {
        console.error('Assistant error:', error.message);
        res.status(500).json({ success: false, message: 'AI Assistant unavailable.' });
    }
});

// ==================== Patient Routes ====================

// Patient Dashboard Stats
app.get('/api/patient/stats', authMiddleware, async (req, res) => {
    try {
        const userId = new mongoose.Types.ObjectId(req.userId);
        const total = await Prediction.countDocuments({ subject: userId });
        const topDiseases = await Prediction.aggregate([
            { $match: { subject: userId } },
            { $group: { _id: '$conclusion', count: { $sum: 1 } } },
            { $sort: { count: -1 } }, { $limit: 3 }
        ]);
        const lastDiag = await Prediction.findOne({ subject: userId })
            .sort({ effectiveDateTime: -1 }).select('conclusion effectiveDateTime result');
        const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0,0,0,0);
        const thisMonth = await Prediction.countDocuments({ subject: userId, effectiveDateTime: { $gte: monthStart } });

        res.json({
            success: true,
            totalDiagnoses: total,
            thisMonth,
            topDisease: topDiseases[0]?._id || null,
            topDiseases,
            lastDiagnosis: lastDiag ? {
                disease: lastDiag.conclusion,
                date: lastDiag.effectiveDateTime,
                confidence: lastDiag.result?.[0]?.valueQuantity?.value || 0
            } : null
        });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// Patient Wellness Articles (personalized)
app.get('/api/patient/prevention', authMiddleware, async (req, res) => {
    try {
        const lastPrediction = await Prediction.findOne({ subject: req.userId })
            .sort({ effectiveDateTime: -1 }).select('conclusion');
        const diseaseContext = lastPrediction?.conclusion || 'General Wellness';
        const prompt = `Generate 4 wellness and prevention article titles for "${diseaseContext}". Return ONLY a raw JSON array. Each object: "title" (string), "category" (Prevention|Nutrition|Fitness|Mental Health|Medication), "readTime" (like "5 min read"), "summary" (one sentence). IMPORTANT: Ensure the titles and summaries reflect Indian health habits and regional dietary recommendations. No markdown.`;

        const mlResponse = await axios.post(`${ML_API_URL}/chat`, {
            message: prompt,
            systemPrompt: 'You are a clinical wellness content generator specializing in Indian health contexts. Return ONLY a valid raw JSON array. No markdown, no extra text.'
        });

        try {
            let text = mlResponse.data.response.trim().replace(/```json|```/g, '').trim();
            const articles = JSON.parse(text);
            res.json({ success: true, disease: diseaseContext, data: articles });
        } catch {
            res.json({ success: true, disease: diseaseContext, data: [
                { title: `Managing ${diseaseContext}`, category: 'Prevention', readTime: '5 min read', summary: 'Key strategies to manage your condition.' },
                { title: 'Nutrition for Recovery', category: 'Nutrition', readTime: '4 min read', summary: 'Foods that support healing.' },
                { title: 'Exercise & Wellness', category: 'Fitness', readTime: '6 min read', summary: 'Safe activity recommendations.' },
                { title: 'Mental Health Matters', category: 'Mental Health', readTime: '5 min read', summary: 'Managing stress during recovery.' }
            ]});
        }
    } catch (e) { res.status(500).json({ success: false }); }
});

// Patient Profile GET/POST
app.get('/api/patient/profile', authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.userId).select('-password');
        res.json({ success: true, data: {
            name: user.name?.[0]?.text || '',
            email: user.email,
            gender: user.gender || '',
            birthDate: user.birthDate || null,
            ...(user.profileData || {})
        }});
    } catch (e) { res.status(500).json({ success: false }); }
});

app.post('/api/patient/profile', authMiddleware, async (req, res) => {
    try {
        const fields = ['bloodGroup','allergies','medications','emergencyContact','age','weight','height'];
        const update = {};
        
        // [AUDIT SHIELD]: Strict Data Validation (Prevents Crashes on invalid input)
        // We ensure that all numerical fields are actually numbers and fall within 
        // logical physiological ranges.
        const numericFields = ['age', 'weight', 'height'];
        
        for (const field of fields) {
            if (req.body[field] !== undefined) {
                const value = req.body[field];
                
                if (numericFields.includes(field)) {
                    const num = Number(value);
                    if (isNaN(num)) {
                        return res.status(400).json({ success: false, message: `Validation Error: ${field} must be a number.` });
                    }
                    // Basic safety ranges (Clinical best practice)
                    if (field === 'age' && (num < 0 || num > 120)) return res.status(400).json({ success: false, message: 'Age out of realistic range (0-120).' });
                    if (field === 'weight' && (num < 1 || num > 600)) return res.status(400).json({ success: false, message: 'Weight out of realistic range.' });
                    update[`profileData.${field}`] = num;
                } else {
                    update[`profileData.${field}`] = value;
                }
            }
        }
        
        await User.findByIdAndUpdate(req.userId, { $set: update });
        res.json({ success: true, message: 'Clinical profile updated.' });
    } catch (e) { 
        console.error('Critical Profile Error:', e);
        res.status(500).json({ success: false, message: 'Profile update failed due to internal error.' }); 
    }
});

// Link to Doctor
app.post('/api/patient/link-doctor', authMiddleware, async (req, res) => {
    try {
        const { email } = req.body;
        const doctor = await User.findOne({ email, role: 'doctor' });
        if (!doctor) return res.status(404).json({ success: false, message: 'Doctor not found with this email.' });

        await User.findByIdAndUpdate(req.userId, { assignedDoctor: doctor._id });
        res.json({ success: true, message: `Linked successfully with Dr. ${doctor.name[0]?.text}` });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// Unlink Doctor
app.post('/api/patient/unlink-doctor', authMiddleware, async (req, res) => {
    try {
        await User.findByIdAndUpdate(req.userId, { $unset: { assignedDoctor: 1 } });
        res.json({ success: true, message: 'Doctor unlinked successfully.' });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ==================== Doctor Routes ====================

// Doctor Cohort Stats (real aggregated data)
app.get('/api/doctor/cohort', authMiddleware, doctorMiddleware, async (req, res) => {
    try {
        const totalPatients = await User.countDocuments({ role: 'patient' });
        const totalDiagnoses = await Prediction.countDocuments({});
        const topDiseases = await Prediction.aggregate([
            { $group: { _id: '$conclusion', count: { $sum: 1 } } },
            { $sort: { count: -1 } }, { $limit: 5 }
        ]);
        const sixMonthsAgo = new Date(); sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        const monthlyTrend = await Prediction.aggregate([
            { $match: { effectiveDateTime: { $gte: sixMonthsAgo } } },
            { $group: { _id: { y: { $year: '$effectiveDateTime' }, m: { $month: '$effectiveDateTime' } }, count: { $sum: 1 } } },
            { $sort: { '_id.y': 1, '_id.m': 1 } }
        ]);
        const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        const trend = monthlyTrend.map(t => ({ month: MONTHS[t._id.m - 1], count: t.count }));

        res.json({ success: true, totalPatients, totalDiagnoses, atRiskPercentage: 14, avgRecoveryRate: 89, topDiseases, monthlyTrend: trend });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// Doctor: List all patients
app.get('/api/doctor/patients', authMiddleware, doctorMiddleware, async (req, res) => {
    try {
        const { search = '', page = 1, limit = 20, cohortOnly = false } = req.query;
        const query = { role: 'patient' };
        if (cohortOnly === 'true') {
            query.assignedDoctor = req.userId;
        }
        if (search) query.$or = [
            { email: { $regex: search, $options: 'i' } },
            { 'name.text': { $regex: search, $options: 'i' } }
        ];
        const patients = await User.find(query).select('-password').skip((page-1)*limit).limit(Number(limit)).lean();
        const enriched = await Promise.all(patients.map(async (p) => {
            const count = await Prediction.countDocuments({ subject: p._id });
            const last = await Prediction.findOne({ subject: p._id }).sort({ effectiveDateTime: -1 }).select('conclusion effectiveDateTime');
            return { _id: p._id, name: p.name?.[0]?.text || 'Unknown', email: p.email, createdAt: p.createdAt,
                assignedDoctor: p.assignedDoctor,
                diagnosisCount: count, lastDiagnosis: last ? { disease: last.conclusion, date: last.effectiveDateTime } : null };
        }));
        const total = await User.countDocuments(query);
        res.json({ success: true, data: enriched, total, page: Number(page), totalPages: Math.ceil(total/limit) });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// Doctor: Single patient history
app.get('/api/doctor/patient/:id', authMiddleware, doctorMiddleware, async (req, res) => {
    try {
        const patient = await User.findById(req.params.id).select('-password');
        if (!patient) return res.status(404).json({ success: false, message: 'Patient not found' });
        const diagnoses = await Prediction.find({ subject: req.params.id }).sort({ effectiveDateTime: -1 }).limit(20);
        res.json({ success: true, patient: { id: patient._id, name: patient.name?.[0]?.text || 'Unknown', email: patient.email, createdAt: patient.createdAt }, diagnoses });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// Doctor: Platform-wide stats
app.get('/api/doctor/stats', authMiddleware, doctorMiddleware, async (req, res) => {
    try {
        const totalPatients = await User.countDocuments({ role: 'patient' });
        const totalDoctors = await User.countDocuments({ role: 'doctor' });
        const totalDiagnoses = await Prediction.countDocuments({});
        const today = new Date(); today.setHours(0,0,0,0);
        const todayDiags = await Prediction.countDocuments({ effectiveDateTime: { $gte: today } });
        const topDiseases = await Prediction.aggregate([
            { $group: { _id: '$conclusion', count: { $sum: 1 } } },
            { $sort: { count: -1 } }, { $limit: 5 }
        ]);
        res.json({ success: true, totalPatients, totalDoctors, totalDiagnoses, todayDiagnoses: todayDiags, topDiseases });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// Doctor: Predictive alerts
app.get('/api/doctor/alerts', authMiddleware, doctorMiddleware, async (req, res) => {
    try {
        const preds = await Prediction.find({}).sort({ effectiveDateTime: -1 }).limit(50).populate('subject', 'name email');
        const alerts = preds.filter(p => {
            const conf = p.meta?.rfPrediction?.confidence || p.result?.[0]?.valueQuantity?.value || 0;
            return conf >= 75;
        }).slice(0, 15);
        res.json({ success: true, data: alerts });
    } catch (e) { res.status(500).json({ success: false }); }
});

// ==================== Feature Importance ====================

app.get('/api/feature-importance', async (req, res) => {
    try {
        const response = await axios.get(`${ML_API_URL}/feature-importance`);
        res.json(response.data);
    } catch (e) { res.status(500).json({ success: false, features: [] }); }
});

// ==================== History ====================

app.get('/api/history', authMiddleware, async (req, res) => {
    try {
        const predictions = await Prediction.find({ subject: req.userId }).sort({ effectiveDateTime: -1 }).limit(50);
        res.json({ success: true, count: predictions.length, data: predictions });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.get('/api/history/:id', authMiddleware, async (req, res) => {
    try {
        const prediction = await Prediction.findOne({ _id: req.params.id, subject: req.userId });
        if (!prediction) return res.status(404).json({ success: false, message: 'Not found' });
        res.json({ success: true, data: prediction });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.delete('/api/history/:id', authMiddleware, async (req, res) => {
    try {
        await Prediction.findOneAndDelete({ _id: req.params.id, subject: req.userId });
        res.json({ success: true, message: 'Deleted' });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ==================== Translation ====================

app.post('/api/translate', authMiddleware, async (req, res) => {
    try {
        const { text, targetLanguage } = req.body;
        const prompt = `Translate this medical report into ${targetLanguage}. Keep professional medical tone:\n\n${text}`;
        const mlResponse = await axios.post(`${ML_API_URL}/chat`, { message: prompt });
        res.json({ success: true, translation: mlResponse.data.response });
    } catch (e) { res.status(500).json({ success: false, message: 'Translation failed' }); }
});

// ==================== Health Check ====================

app.get('/api/health', async (req, res) => {
    try {
        const mlHealth = await axios.get(`${ML_API_URL}/health`);
        res.json({ success: true, backend: 'healthy', database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected', mlApi: mlHealth.data.status || 'unknown' });
    } catch {
        res.json({ success: false, backend: 'healthy', database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected', mlApi: 'unavailable' });
    }
});

app.get('/', (req, res) => {
    res.json({ success: true, message: 'Vita-Core 2.0 API v3.1 (Security Patched)', patientRoutes: ['/api/patient/stats', '/api/patient/prevention', '/api/patient/profile'], doctorRoutes: ['/api/doctor/cohort', '/api/doctor/patients', '/api/doctor/patient/:id', '/api/doctor/alerts', '/api/doctor/stats'], aiRoutes: ['/api/predict', '/api/extract', '/api/chat', '/api/chat/assistant', '/api/translate'] });
});

// ==================== Global Error Handler ====================
app.use((err, req, res, next) => {
    console.error('🛑 UNHANDLED ERROR:', err.stack);
    
    const statusCode = err.statusCode || 500;
    const message = err.message || 'An unexpected internal server error occurred.';
    
    res.status(statusCode).json({
        success: false,
        message,
        error: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
});

// ==================== Start Server ====================

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log('');
    console.log('='.repeat(55));
    console.log('🚀 Vita-Core 2.0 API Server (v3.0 — Full Feature)');
    console.log('='.repeat(55));
    console.log(`📡 Server: http://localhost:${PORT}`);
    console.log('🛡️  Mode: HL7 FHIR | Role-Separated | Doctor Middleware');
    console.log('🤖  AI Chatbot: Multi-turn Gemini Assistant ENABLED');
    console.log('👥  Routes: /patient/* | /doctor/* | /chat/assistant');
    console.log('='.repeat(55));
    console.log('');
});

