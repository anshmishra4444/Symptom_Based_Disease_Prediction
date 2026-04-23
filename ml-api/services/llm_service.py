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
            response = self.client.models.generate_content(model='gemini-2.0-flash', contents=contents)
            text_res = response.text.strip().replace("```json", "").replace("```", "")
            extracted = json.loads(text_res)
            valid = [s for s in extracted if s in self.symptom_list]
            return {"success": True, "symptoms": valid}
        except Exception as e:
            return {"success": False, "message": str(e)}

    def generate_soap_note(self, symptoms: List[str], disease: str, confidence: float) -> str:
        """ Generates a professional clinical SOAP note """
        if not self.client: return "AI SOAP Note unavailable."
        
        prompt = (
            f"Generate a professional clinical SOAP note for a patient with: {', '.join(symptoms)}. "
            f"Diagnosis: {disease} ({confidence:.1f}% confidence). "
            "Include Subjective, Objective, Assessment, and Plan."
        )
        try:
            response = self.client.models.generate_content(model='gemini-2.0-flash', contents=[prompt])
            return response.text.strip()
        except Exception as e:
            return f"Error generating SOAP note: {str(e)}"

    def chat(self, message: str, system_prompt: Optional[str] = None) -> Dict:
        """ Handles general clinical chat and reasoning """
        if not self.client:
            return {"success": False, "message": "Gemini API Key missing."}

        contents = []
        if system_prompt:
            contents.append(f"SYSTEM INSTRUCTION: {system_prompt}")
        contents.append(message)

        try:
            response = self.client.models.generate_content(model='gemini-2.0-flash', contents=contents)
            return {"success": True, "response": response.text.strip()}
        except Exception as e:
            return {"success": False, "message": str(e)}
