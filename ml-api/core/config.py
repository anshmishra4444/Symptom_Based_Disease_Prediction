import os
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# ==================== System Configuration & Hyperparameters ====================
# [AUDIT TIP]: These parameters control the core logic of the diagnostic engine.

MODEL_CONFIG = {
    # File Paths (Relative to project root for portability)
    "rf_path": Path("../models/random_forest_model.pkl").resolve(),
    "knn_path": Path("../models/knn_model.pkl").resolve(),
    "symptoms_path": Path("../models/symptoms.json").resolve(),
    "diseases_path": Path("../models/diseases.json").resolve(),
    
    # Model Behavior
    "confidence_threshold": 0.50,  
    "realism_buffer": 0.018,       # Max deduction for realism
    
    # API Integration
    "gemini_api_key": os.getenv("GEMINI_API_KEY"),
}

# Ensure model files exist before proceeding
def validate_assets():
    for key, path in MODEL_CONFIG.items():
        if "path" in key and not path.exists():
            print(f"[WARNING] Model asset missing at {path}")
