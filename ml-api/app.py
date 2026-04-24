
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import pickle
import json
import os
import numpy as np

app = FastAPI(title="Lightweight ML API")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ================= LOAD MODELS =================

rf_model = None
knn_model = None
symptoms = []

def load_models():
    global rf_model, knn_model, symptoms
    
    BASE_DIR = os.path.dirname(__file__)
    model_dir = os.path.join(BASE_DIR, "models")

    try:
        with open(os.path.join(model_dir, "random_forest_model.pkl"), "rb") as f:
            rf_model = pickle.load(f)

        with open(os.path.join(model_dir, "knn_model.pkl"), "rb") as f:
            knn_model = pickle.load(f)

        with open(os.path.join(model_dir, "symptoms.json"), "r") as f:
            symptoms = json.load(f)["symptoms"]

        print("✅ Models loaded successfully")

    except Exception as e:
        print("❌ Model loading failed:", e)


@app.on_event("startup")
def startup():
    load_models()


# ================= ROUTES =================

@app.get("/")
def home():
    return {"message": "ML API Running"}

@app.get("/health")
def health():
    return {"status": "healthy"}

@app.get("/symptoms")
def get_symptoms():
    return {"success": True, "symptoms": symptoms}


@app.post("/predict")
def predict(data: dict):
    try:
        input_symptoms = [s.lower().strip() for s in data.get("symptoms", [])]

        if not input_symptoms:
            raise HTTPException(status_code=400, detail="No symptoms provided")

        # Create vector
        input_vector = np.zeros(len(symptoms))
        for s in input_symptoms:
            if s in symptoms:
                input_vector[symptoms.index(s)] = 1

        # Predictions
        pred_rf = rf_model.predict([input_vector])[0]
        conf_rf = np.max(rf_model.predict_proba([input_vector])) * 100

        pred_knn = knn_model.predict([input_vector])[0]
        conf_knn = np.max(knn_model.predict_proba([input_vector])) * 100

        if conf_rf >= conf_knn:
            final_pred = pred_rf
            final_conf = conf_rf
            model_used = "Random Forest"
        else:
            final_pred = pred_knn
            final_conf = conf_knn
            model_used = "KNN"

        return {
            "success": True,
            "disease": final_pred,
            "confidence": final_conf,
            "model_used": model_used
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ================= MAIN =================

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 10000))
    uvicorn.run(app, host="0.0.0.0", port=port)



# """
# Vita-Core 2.0 ML Service - Orchestrator
# Modularized for professional viva review and industrial scalability.
# Main Logic split into /services and /core.
# """

# from fastapi import FastAPI, HTTPException
# from fastapi.middleware.cors import CORSMiddleware
# from pydantic import BaseModel
# from typing import List, Dict, Optional
# import os

# # Internal Modules
# from core.config import MODEL_CONFIG, validate_assets
# from services.prediction_service import PredictionService
# from services.explainability_service import ExplainabilityService
# from services.llm_service import LLMService
# from services.gnn_service import GNNService

# # Initialize FastAPI
# app = FastAPI(
#     title="VITA-CORE 2.0 AI Engine",
#     description="Refactored Modular ML Service for Clinical Decision Support",
#     version="2.0.0"
# )

# # CORS configuration
# app.add_middleware(
#     CORSMiddleware,
#     allow_origins=["*"],
#     allow_credentials=True,
#     allow_methods=["*"],
#     allow_headers=["*"],
# )

# # Service Instances
# predict_service = PredictionService()
# llm_service = None
# xai_service = None
# gnn_service = None

# @app.on_event("startup")
# async def startup_event():
#     """ Initialize modular services at startup """
#     global llm_service, xai_service, gnn_service
#     print("Starting Clean Architecture AI Engine...")
    
#     # 1. Validate Assets
#     validate_assets()
    
#     # 2. Load ML Models
#     predict_service.load_assets()
#     symptom_list = predict_service.symptom_list
#     num_symptoms = len(symptom_list)
    
#     # 3. Load Auxiliary Services
#     llm_service = LLMService(symptom_list)
#     xai_service = ExplainabilityService(predict_service.rf_model, symptom_list)
#     gnn_service = GNNService(num_symptoms, symptom_list)
    
#     print("System Ready & Hardened.")

# # ==================== Pydantic Schemas ====================

# class PredictionRequest(BaseModel):
#     symptoms: List[str]

# class PredictionResponse(BaseModel):
#     success: bool
#     rf_prediction: Dict
#     knn_prediction: Dict
#     final_prediction: Dict
#     disease_info: Dict
#     agentic_soap_note: Optional[str] = None
#     xai_explanation: Optional[List[Dict]] = None
#     related_symptoms: Optional[List[str]] = None

# class MultimodalRequest(BaseModel):
#     text: Optional[str] = None
#     image: Optional[str] = None
#     audio: Optional[str] = None
#     mime_type: Optional[str] = None

# class ChatRequest(BaseModel):
#     message: str
#     systemPrompt: Optional[str] = None

# # ==================== Routes ====================

# @app.get("/health")
# async def health():
#     return {"status": "healthy", "architecture": "modular"}

# @app.get("/symptoms")
# async def get_symptoms():
#     return {"success": True, "symptoms": predict_service.symptom_list}

# @app.get("/feature-importance")
# async def get_features():
#     return xai_service.get_global_importance()

# @app.post("/chat")
# async def chat(request: ChatRequest):
#     res = llm_service.chat(request.message, request.systemPrompt)
#     return res

# @app.post("/predict", response_model=PredictionResponse)
# async def predict(request: PredictionRequest):
#     """ Main diagnostic orchestrator """
#     try:
#         # 1. Ensemble Prediction
#         res = predict_service.predict(request.symptoms)
#         vector = predict_service.prepare_vector(request.symptoms)
        
#         # 2. Explainability (SHAP)
#         xai_data = xai_service.get_shap_values(vector)
        
#         # 3. GNN Correlations
#         related = gnn_service.get_related_symptoms(vector, request.symptoms)
        
#         # 4. Agentic AI (Gemini)
#         soap_note = llm_service.generate_soap_note(
#             request.symptoms, res["disease"], res["confidence"]
#         )
        
#         return PredictionResponse(
#             success=True,
#             rf_prediction=res["rf"],
#             knn_prediction=res["knn"],
#             final_prediction={
#                 "disease": res["disease"],
#                 "confidence": res["confidence"],
#                 "model_used": res["model_used"]
#             },
#             disease_info={"description": "Clinical overview generated.", "precautions": []},
#             agentic_soap_note=soap_note,
#             xai_explanation=xai_data,
#             related_symptoms=related
#         )
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=str(e))

# @app.post("/extract-symptoms")
# async def extract(request: MultimodalRequest):
#     """ Multimodal entry point """
#     res = llm_service.extract_symptoms(
#         text=request.text, 
#         image_b64=request.image, 
#         audio_b64=request.audio, 
#         mime_type=request.mime_type
#     )
#     return res

# if __name__ == "__main__":
#     import uvicorn
#     uvicorn.run(app, host="0.0.0.0", port=8000)
