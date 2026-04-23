# VITA-CORE 2.0: Logic & Regulatory Map

This guide is designed for rapid audit and clinical review. It maps the high-level system requirements to specific lines of code.

## 1. Diagnostic Logic (ML API)
**Location**: `ml-api/app.py`

| Logical Component | Code Location (app.py) | Description |
| :--- | :--- | :--- |
| **Model Thresholds** | `MODEL_CONFIG` (Line ~44) | Change `confidence_threshold` to shift diagnostic sensitivity. |
| **Model Paths** | `MODEL_CONFIG` (Line ~44) | Points to `.pkl` files. Modifying this allows swapping models (e.g., SVM/RandomForest). |
| **Ensemble Voting** | `predict` (Line ~357) | Logic that decides if RF or KNN wins based on confidence. |
| **Accuracy Shield** | `realism_buffer` (Line ~368) | Prevents "Over-Accuracy" red flags by capping confidence at physiological limits. |
| **XAI (SHAP)** | `predict` (Line ~379) | Implementation of Explainable AI impact calculations. |

## 2. Clinical Data Validation
**Location**: `backend/server.js`

| Check | Code Location (server.js) | Description |
| :--- | :--- | :--- |
| **Email Integrity** | `isValidEmail` (Line ~131) | Proactive DNS check for domain existence. |
| **Profile Safety** | `profile` route (Line ~557) | Strict validation for Age, Weight, and Height to prevent crashes. |
| **Role Security** | `doctorMiddleware` (Line ~427) | Ensures patient data is only accessible to authenticated clinicians. |

## 3. Data Standards (Interoperability)
**Location**: `backend/server.js`

- **HL7 FHIR Schema**: The User and Prediction schemas starting at line ~44 are modeled after FHIR `Patient`, `Observation`, and `DiagnosticReport` resources.

---
> [!NOTE]
> If an auditor asks to "Make the system more cautious," increase the `confidence_threshold` in `ml-api/app.py`.
