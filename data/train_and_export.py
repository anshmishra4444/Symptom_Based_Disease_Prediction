"""
Extract and Save ML Models from Your Notebook
This script recreates your exact ML model training and saves it for API use
"""

import pandas as pd
import numpy as np
import pickle
import json
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.neighbors import KNeighborsClassifier
from sklearn.metrics import accuracy_score

import os

# Create models directory if it doesn't exist
os.makedirs('../models', exist_ok=True)

print("="*60)
print("Disease Prediction Model - Training & Export")
print("="*60)

# STEP 1: Load Your Datasets
print("\n📂 Loading datasets...")
try:
    dataset = pd.read_csv("dataset.csv")
    symptom_desc = pd.read_csv("symptom_Description.csv")
    symptom_prec = pd.read_csv("symptom_precaution.csv")
    
    print(f"✅ Dataset loaded: {dataset.shape}")
    print(f"✅ Unique diseases: {dataset['Disease'].nunique()}")
except Exception as e:
    print(f"❌ Error loading files: {e}")
    print("\nPlease ensure these files are in the same directory:")
    print("  - dataset.csv")
    print("  - symptom_Description.csv")
    print("  - symptom_precaution.csv")
    exit(1)

# STEP 2: Prepare Data (Exactly like your notebook)
print("\n🔄 Processing data...")

# Identify symptom columns
symptom_cols = [col for col in dataset.columns if col.startswith('Symptom')]
print(f"Found {len(symptom_cols)} symptom columns")

# Get all unique symptoms
all_symptoms = pd.unique(dataset[symptom_cols].values.ravel())
all_symptoms = [s.strip().lower() for s in all_symptoms if isinstance(s, str)]
all_symptoms = sorted(set(all_symptoms))

print(f"Total unique symptoms: {len(all_symptoms)}")

# Create binary symptom matrix (same as your notebook)
X = pd.DataFrame(0, index=np.arange(len(dataset)), columns=all_symptoms)

for i, row in dataset.iterrows():
    for col in symptom_cols:
        val = str(row[col]).strip().lower()
        if val != 'nan' and val in X.columns:
            X.at[i, val] = 1

# Labels
y = dataset['Disease']

print(f"Feature matrix shape: {X.shape}")
print(f"Total samples: {len(y)}")

# STEP 3: Split Data
print("\n✂️ Splitting data...")
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42
)
print(f"Training set: {len(X_train)}")
print(f"Test set: {len(X_test)}")

# STEP 4: Train Random Forest (Your exact configuration)
print("\n🌲 Training Random Forest...")
rf = RandomForestClassifier(n_estimators=200, random_state=90)
rf.fit(X_train, y_train)

y_pred_rf = rf.predict(X_test)
acc_rf = accuracy_score(y_test, y_pred_rf)
print(f"✅ Random Forest Accuracy: {acc_rf*100:.2f}%")

# STEP 5: Train KNN (Your exact configuration)
print("\n🎯 Training KNN...")
knn = KNeighborsClassifier(n_neighbors=5)
knn.fit(X_train, y_train)

y_pred_knn = knn.predict(X_test)
acc_knn = accuracy_score(y_test, y_pred_knn)
print(f"✅ KNN Accuracy: {acc_knn*100:.2f}%")

# STEP 6: Save Models
print("\n💾 Saving models...")

# Save Random Forest
with open('../models/random_forest_model.pkl', 'wb') as f:
    pickle.dump(rf, f)
print("✅ Random Forest saved: models/random_forest_model.pkl")

# Save KNN
with open('../models/knn_model.pkl', 'wb') as f:
    pickle.dump(knn, f)
print("✅ KNN saved: models/knn_model.pkl")

# Save symptom list (feature names)
symptom_data = {
    'symptoms': list(X.columns),
    'count': len(X.columns)
}
with open('../models/symptoms.json', 'w') as f:
    json.dump(symptom_data, f, indent=2)
print(f"✅ Symptoms saved: models/symptoms.json ({len(X.columns)} symptoms)")

# Save disease list
disease_data = {
    'diseases': sorted(y.unique().tolist()),
    'count': y.nunique()
}
with open('../models/diseases.json', 'w') as f:
    json.dump(disease_data, f, indent=2)
print(f"✅ Diseases saved: models/diseases.json ({y.nunique()} diseases)")

# STEP 7: Prepare supplementary data
print("\n📋 Processing supplementary data...")

# Disease descriptions
desc_dict = {}
if 'Disease' in symptom_desc.columns and 'Description' in symptom_desc.columns:
    for _, row in symptom_desc.iterrows():
        desc_dict[row['Disease']] = row['Description']
    
with open('../models/disease_descriptions.json', 'w') as f:
    json.dump(desc_dict, f, indent=2)
print(f"✅ Descriptions saved: {len(desc_dict)} diseases")

# Disease precautions
prec_dict = {}
if 'Disease' in symptom_prec.columns:
    for _, row in symptom_prec.iterrows():
        disease = row['Disease']
        precautions = [str(p) for p in row.drop('Disease').values if str(p) != 'nan']
        prec_dict[disease] = precautions

with open('../models/disease_precautions.json', 'w') as f:
    json.dump(prec_dict, f, indent=2)
print(f"✅ Precautions saved: {len(prec_dict)} diseases")

# STEP 8: Test prediction function
print("\n🧪 Testing prediction...")

def test_predict(symptom_list):
    """Test the saved models"""
    input_vector = np.zeros(len(X.columns))
    symptom_list = [s.lower().strip() for s in symptom_list]
    
    for s in symptom_list:
        if s in X.columns:
            input_vector[X.columns.get_loc(s)] = 1
    
    pred_rf = rf.predict([input_vector])[0]
    conf_rf = np.max(rf.predict_proba([input_vector])) * 100
    
    pred_knn = knn.predict([input_vector])[0]
    conf_knn = np.max(knn.predict_proba([input_vector])) * 100
    
    return {
        'rf': {'disease': pred_rf, 'confidence': conf_rf},
        'knn': {'disease': pred_knn, 'confidence': conf_knn}
    }

# Test with your example
test_symptoms = ['itching', 'skin_rash', 'nodal_skin_eruptions']
result = test_predict(test_symptoms)

print(f"Test symptoms: {test_symptoms}")
print(f"RF Prediction: {result['rf']['disease']} ({result['rf']['confidence']:.2f}%)")
print(f"KNN Prediction: {result['knn']['disease']} ({result['knn']['confidence']:.2f}%)")

# STEP 9: Summary
print("\n" + "="*60)
print("✅ MODEL EXPORT COMPLETE!")
print("="*60)
print("\n📦 Files created:")
print("  1. models/random_forest_model.pkl")
print("  2. models/knn_model.pkl")
print("  3. models/symptoms.json")
print("  4. models/diseases.json")
print("  5. models/disease_descriptions.json")
print("  6. models/disease_precautions.json")
print("\n🚀 Models ready for API integration!")
print("="*60)
