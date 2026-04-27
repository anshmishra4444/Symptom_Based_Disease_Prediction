
"""
Vita-Core 2.0 ML Service - Orchestrator
Modularized for professional viva review and industrial scalability.
Main Logic split into /services and /core.
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Optional
import os

# Internal Modules
from core.config import MODEL_CONFIG, validate_assets
from services.prediction_service import PredictionService
from services.explainability_service import ExplainabilityService
from services.llm_service import LLMService
from services.gnn_service import GNNService

# Initialize FastAPI
app = FastAPI(
    title="VITA-CORE 2.0 AI Engine",
    description="Refactored Modular ML Service for Clinical Decision Support",
    version="2.0.0"
)

# CORS configurations
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Service Instances
predict_service = PredictionService()
llm_service = None
xai_service = None
gnn_service = None

@app.on_event("startup")
async def startup_event():
    """ Initialize modular services at startup """
    global llm_service, xai_service, gnn_service
    print("Starting Clean Architecture AI Engine...")
    
    # 1. Validate Assets
    validate_assets()
    
    # 2. Load ML Models
    predict_service.load_assets()
    symptom_list = predict_service.symptom_list
    num_symptoms = len(symptom_list)
    
    # 3. Load Auxiliary Services
    llm_service = LLMService(symptom_list)
    xai_service = ExplainabilityService(predict_service.rf_model, symptom_list)
    gnn_service = GNNService(num_symptoms, symptom_list)
    
    print("System Ready & Hardened.")

# ==================== Pydantic Schemas ====================

class PredictionRequest(BaseModel):
    symptoms: List[str]

class PredictionResponse(BaseModel):
    success: bool
    rf_prediction: Dict
    knn_prediction: Dict
    final_prediction: Dict
    disease_info: Dict
    agentic_soap_note: Optional[str] = None
    xai_explanation: Optional[List[Dict]] = None
    related_symptoms: Optional[List[str]] = None

class MultimodalRequest(BaseModel):
    text: Optional[str] = None
    image: Optional[str] = None
    audio: Optional[str] = None
    mime_type: Optional[str] = None

class ChatRequest(BaseModel):
    message: str
    systemPrompt: Optional[str] = None

# ==================== Routes ====================

@app.get("/health")
async def health():
    return {"status": "healthy", "architecture": "modular"}

@app.get("/symptoms")
async def get_symptoms():
    return {"success": True, "symptoms": predict_service.symptom_list}

@app.get("/feature-importance")
async def get_features():
    return xai_service.get_global_importance()

@app.post("/chat")
async def chat(request: ChatRequest):
    res = llm_service.chat(request.message, request.systemPrompt)
    return res

@app.post("/predict", response_model=PredictionResponse)
async def predict(request: PredictionRequest):
    """ Main diagnostic orchestrator """
    try:
        # 1. Ensemble Prediction
        res = predict_service.predict(request.symptoms)
        vector = predict_service.prepare_vector(request.symptoms)
        
        # 2. Explainability (SHAP)
        xai_data = xai_service.get_shap_values(vector)
        
        # 3. GNN Correlations
        related = gnn_service.get_related_symptoms(vector, request.symptoms)
        
        # 4. Agentic AI (Gemini)
        soap_note = llm_service.generate_soap_note(
            request.symptoms, res["disease"], res["confidence"]
        )
        
        return PredictionResponse(
            success=True,
            rf_prediction=res["rf"],
            knn_prediction=res["knn"],
            final_prediction={
                "disease": res["disease"],
                "confidence": res["confidence"],
                "model_used": res["model_used"]
            },
            disease_info={"description": "Clinical overview generated.", "precautions": []},
            agentic_soap_note=soap_note,
            xai_explanation=xai_data,
            related_symptoms=related
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/extract-symptoms")
async def extract(request: MultimodalRequest):
    """ Multimodal entry point """
    res = llm_service.extract_symptoms(
        text=request.text, 
        image_b64=request.image, 
        audio_b64=request.audio, 
        mime_type=request.mime_type
    )
    return res

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
