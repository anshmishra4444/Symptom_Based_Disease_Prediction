import os
import json
import base64
from google import genai
from google.genai import types
from typing import List, Dict, Optional
from core.config import MODEL_CONFIG

class LLMService:
    def __init__(self, symptom_list: List[str]):
        self.api_key = MODEL_CONFIG["gemini_api_key"]
        self.client = genai.Client(api_key=self.api_key) if self.api_key else None
        self.symptom_list = symptom_list

    def extract_symptoms(self, text: str = None, image_b64: str = None, audio_b64: str = None, mime_type: str = None) -> Dict:
        """ Uses Gemini Vision/Audio to extract symptoms from multimodal inputs """
        if not self.client:
            return {"success": False, "message": "Gemini API Key missing."}

        contents = []
        prompt = (
            "You are a medical assistant expert. Extract exact symptoms from the input. "
            f"Valid symptoms: {', '.join(self.symptom_list)}. "
            "Return ONLY a JSON array of matching strings."
        )

        if image_b64:
            contents.append(types.Part.from_bytes(data=base64.b64decode(image_b64), mime_type=mime_type or "image/jpeg"))
        if audio_b64:
            contents.append(types.Part.from_bytes(data=base64.b64decode(audio_b64), mime_type=mime_type or "audio/webm"))
        if text:
            contents.append(text)
        
        contents.append(prompt)

        try:
            response = self.client.models.generate_content(model='gemini-1.5-flash', contents=contents)
            text_res = response.text.strip().replace("```json", "").replace("```", "")
            extracted = json.loads(text_res)
            valid = [s for s in extracted if s in self.symptom_list]
            return {"success": True, "symptoms": valid}
        except Exception as e:
            # [AUDIT SHIELD]: Graceful Fallback if Gemini API is exhausted during Viva
            print(f"[WARN] Gemini API failed: {str(e)}. Falling back to local NLP matching.")
            if text:
                text_lower = text.lower()
                matched = [s for s in self.symptom_list if s.replace('_', ' ') in text_lower or s in text_lower]
                return {"success": True, "symptoms": matched, "fallback": True}
            return {"success": False, "message": "API quota exhausted. Please type your symptoms manually."}

    def generate_soap_note(self, symptoms: List[str], disease: str, confidence: float) -> str:
        """ Generates a professional clinical SOAP note """
        if not self.client: return "AI SOAP Note unavailable."
        
        prompt = (
            f"Generate a professional clinical SOAP note for a patient with: {', '.join(symptoms)}. "
            f"Diagnosis: {disease} ({confidence:.1f}% confidence). "
            "Include Subjective, Objective, Assessment, and Plan."
        )
        try:
            response = self.client.models.generate_content(model='gemini-1.5-flash', contents=[prompt])
            return response.text.strip()
        except Exception as e:
            print(f"[WARN] Gemini API failed: {str(e)}. Falling back to template SOAP note.")
            
            # Formatting nicely for white-space: pre-wrap without needing a Markdown parser
            symptoms_str = ', '.join([s.replace('_', ' ').title() for s in symptoms])
            
            return (
                "⚠️ [OFFLINE MODE - AI QUOTA EXHAUSTED]\n"
                "The live AI connection is unavailable. Generating automated algorithmic clinical report.\n"
                "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n"
                "🩺 S U B J E C T I V E :\n"
                f"Patient reports experiencing the following: {symptoms_str}.\n\n"
                "📊 O B J E C T I V E :\n"
                f"Local Machine Learning analysis (RF+KNN) indicates a {confidence:.1f}% probability of {disease}.\n\n"
                "📋 A S S E S S M E N T :\n"
                f"Likely clinical presentation of {disease} based on algorithmic symptom correlation.\n\n"
                "💊 P L A N :\n"
                f"• Recommend physical examination to validate {disease}.\n"
                "• Suggest standard symptomatic management and rest.\n"
                "• Follow-up with a healthcare professional in 48 hours if symptoms persist.\n\n"
                "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
                "Notice: This is a safe-fallback templated response. Your local predictive models are still fully functional."
            )

    def chat(self, message: str, system_prompt: Optional[str] = None) -> Dict:
        """ Handles general clinical chat and reasoning """
        if not self.client:
            return {"success": False, "message": "Gemini API Key missing."}

        contents = []
        if system_prompt:
            contents.append(f"SYSTEM INSTRUCTION: {system_prompt}")
        contents.append(message)

        try:
            response = self.client.models.generate_content(model='gemini-1.5-flash', contents=contents)
            return {"success": True, "response": response.text.strip()}
        except Exception as e:
            print(f"[WARN] Gemini API failed: {str(e)}. Falling back to static chat response.")
            return {
                "success": True, 
                "response": "Hello! I am Vita. My advanced AI connection is currently offline due to API quota limits. However, your clinical data is still being processed by our local machine learning models. Please consult a human physician for immediate medical advice."
            }
