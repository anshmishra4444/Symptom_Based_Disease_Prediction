const mongoose = require('mongoose');

const diagnosticSchema = new mongoose.Schema({
    resourceType: { type: String, default: 'DiagnosticReport' },
    status: { type: String, default: 'final' },
    subject: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    effectiveDateTime: { type: Date, default: Date.now },
    performer: [{ display: String }],
    
    // Clinical Findings
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
    
    // AI Metadata
    meta: {
        rfPrediction: Object,
        knnPrediction: Object,
        xaiExplanation: Object,
        causalInsight: Object,
        relatedSymptoms: [String],
        soapNote: String
    }
});

module.exports = mongoose.model('Prediction', diagnosticSchema);
