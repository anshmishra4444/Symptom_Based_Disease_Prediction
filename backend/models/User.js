const mongoose = require('mongoose');

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
    
    // Auth & Personal Data
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['patient', 'doctor'], default: 'patient' },
    assignedDoctor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    profileData: {
        bloodGroup: String,
        allergies: String,
        medications: String,
        emergencyContact: String,
        age: Number,
        weight: Number,
        height: Number
    },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', patientSchema);
