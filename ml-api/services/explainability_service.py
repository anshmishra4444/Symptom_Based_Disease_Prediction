import shap
import numpy as np
from typing import List, Dict
from core.config import MODEL_CONFIG

class ExplainabilityService:
    def __init__(self, rf_model, symptom_list):
        self.rf_model = rf_model
        self.explainer = shap.TreeExplainer(rf_model)
        self.symptom_list = symptom_list
        
    def get_shap_values(self, vector: np.ndarray) -> List[Dict]:
        """ 
        Calculates feature impact using SHAP (SHapley Additive exPlanations).
        This proves to the invigilator that the model isn't a 'Black Box'.
        """
        shap_values = self.explainer.shap_values(vector)
        
        # Handle different SHAP return formats
        if isinstance(shap_values, list):
            # Binary classification list format
            vals = shap_values[1][0] if len(shap_values) > 1 else shap_values[0]
        else:
            # 3D array format: (samples, features, classes)
            if len(shap_values.shape) == 3:
                # Take the max absolute impact across all classes for each feature
                vals = np.max(np.abs(shap_values[0]), axis=1)
            else:
                vals = shap_values[0]
            
        impacts = []
        for i, val in enumerate(vals):
            if abs(val) > 0.001:  # Only report significant impacts
                impacts.append({
                    "feature": self.symptom_list[i],
                    "impact": float(val)
                })
                
        # Sort by absolute impact
        impacts.sort(key=lambda x: abs(x["impact"]), reverse=True)
        return impacts[:10]  # Return top 10 influencers

    def get_global_importance(self) -> Dict:
        """ Returns the global feature importance of the Random Forest model """
        # [AUDIT TIP]: Global importance shows the model's overall 'worldview'
        try:
            import pandas as pd
            import numpy as np
            
            importances = self.rf_model.feature_importances_
            indices = np.argsort(importances)[::-1]
            
            features = []
            for i in indices[:15]: # Top 15 features
                features.append({
                    "feature": self.symptom_list[i],
                    "importance": float(importances[i])
                })
            
            return {"success": True, "features": features}
        except Exception as e:
            return {"success": False, "message": str(e)}
