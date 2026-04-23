# Save as disease_predictor.py
import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.neighbors import KNeighborsClassifier
import pickle
import os

class DiseasePredictor:
    def __init__(self, data_dir='../data/'):
        self.data_dir = data_dir
        self.rf_model = None
        self.knn_model = None
        self.X_columns = None
        self.symptom_desc = None
        self.symptom_prec = None
        self.dataset = None
        self.all_symptoms = []
        
    def load_and_train(self):
        """Load data and train models exactly as in your notebook"""
        try:
            print("📂 Loading datasets...")
            
            # Load datasets (adjust paths as needed)
            self.dataset = pd.read_csv(os.path.join(self.data_dir, "dataset.csv"))
            self.symptom_desc = pd.read_csv(os.path.join(self.data_dir, "symptom_Description.csv"))
            self.symptom_prec = pd.read_csv(os.path.join(self.data_dir, "symptom_precaution.csv"))
            symptom_sev = pd.read_csv(os.path.join(self.data_dir, "Symptom-severity.csv"))
            
            print("✅ Files loaded successfully!")
            print(f"📊 Dataset shape: {self.dataset.shape}")
            print(f"🦠 Unique Diseases: {self.dataset['Disease'].nunique()}")
            
            # Identify all symptom columns
            symptom_cols = []
            for col in self.dataset.columns:
                if col.startswith('Symptom'):
                    symptom_cols.append(col)
            print(f"🔍 Symptom Columns: {len(symptom_cols)} columns")
            
            # Get all unique symptoms
            all_symptoms = pd.unique(self.dataset[symptom_cols].values.ravel())
            all_symptoms = [s.strip().lower() for s in all_symptoms if isinstance(s, str)]
            all_symptoms = sorted(set(all_symptoms))
            self.all_symptoms = all_symptoms
            
            print(f"📋 Total unique symptoms: {len(all_symptoms)}")
            
            # Create binary symptom vectors
            X = pd.DataFrame(0, index=np.arange(len(self.dataset)), columns=all_symptoms)
            
            for i, row in self.dataset.iterrows():
                for col in symptom_cols:
                    val = str(row[col]).strip().lower()
                    if val != 'nan' and val in X.columns:
                        X.at[i, val] = 1
            
            # Labels
            y = self.dataset['Disease']
            
            # Store column names for later use
            self.X_columns = X.columns.tolist()
            
            print("🤖 Training models...")
            
            # Train Random Forest
            print("🌲 Training Random Forest...")
            self.rf_model = RandomForestClassifier(n_estimators=200, random_state=90)
            self.rf_model.fit(X, y)  # Using full dataset as in production
            
            # Train KNN
            print("👥 Training KNN...")
            self.knn_model = KNeighborsClassifier(n_neighbors=5)
            self.knn_model.fit(X, y)  # Using full dataset as in production
            
            print("✅ Models trained successfully!")
            
            # Calculate accuracy if you want
            from sklearn.model_selection import train_test_split
            X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
            rf_acc = self.rf_model.score(X_test, y_test)
            knn_acc = self.knn_model.score(X_test, y_test)
            
            print(f"📈 Random Forest Accuracy: {rf_acc*100:.2f}%")
            print(f"📈 KNN Accuracy: {knn_acc*100:.2f}%")
            
            return True
            
        except Exception as e:
            print(f"❌ Error in training: {e}")
            return False
    
    def predict_disease(self, symptom_list):
        """Predict disease from symptoms"""
        if self.rf_model is None or self.knn_model is None:
            raise ValueError("Models not trained. Call load_and_train() first.")
        
        input_vector = np.zeros(len(self.X_columns))
        symptom_list = [s.lower().strip() for s in symptom_list]
        
        # Create input vector
        for s in symptom_list:
            if s in self.X_columns:
                input_vector[self.X_columns.index(s)] = 1
        
        # Predictions from both models
        pred_rf = self.rf_model.predict([input_vector])[0]
        conf_rf = np.max(self.rf_model.predict_proba([input_vector])) * 100
        
        pred_knn = self.knn_model.predict([input_vector])[0]
        conf_knn = np.max(self.knn_model.predict_proba([input_vector])) * 100
        
        # Choose final result based on higher confidence
        if conf_rf >= conf_knn:
            final_pred, final_conf, model_used = pred_rf, conf_rf, "Random Forest"
        else:
            final_pred, final_conf, model_used = pred_knn, conf_knn, "KNN"
        
        # Get description
        description = ""
        if self.symptom_desc is not None and 'Disease' in self.symptom_desc.columns and 'Description' in self.symptom_desc.columns:
            desc_row = self.symptom_desc[self.symptom_desc['Disease'] == final_pred]
            if len(desc_row):
                description = desc_row['Description'].values[0]
        
        # Get precautions
        precautions = []
        if self.symptom_prec is not None and 'Disease' in self.symptom_prec.columns:
            prec_row = self.symptom_prec[self.symptom_prec['Disease'] == final_pred]
            if len(prec_row):
                # Get all precaution columns
                prec_cols = [col for col in prec_row.columns if col != 'Disease']
                for col in prec_cols:
                    prec_val = prec_row[col].values[0]
                    if pd.notna(prec_val):
                        precautions.append(str(prec_val))
        
        return {
            'rf_prediction': pred_rf,
            'rf_confidence': conf_rf,
            'knn_prediction': pred_knn,
            'knn_confidence': conf_knn,
            'final_prediction': final_pred,
            'final_confidence': final_conf,
            'model_used': model_used,
            'description': description,
            'precautions': precautions,
            'matched_symptoms': [s for s in symptom_list if s in self.X_columns]
        }
    
    def get_all_symptoms(self):
        """Get list of all symptoms"""
        return self.all_symptoms
    
    def save_models(self, model_dir='../models/'):
        """Save trained models to disk"""
        os.makedirs(model_dir, exist_ok=True)
        
        with open(os.path.join(model_dir, 'random_forest_model.pkl'), 'wb') as f:
            pickle.dump(self.rf_model, f)
        
        with open(os.path.join(model_dir, 'knn_model.pkl'), 'wb') as f:
            pickle.dump(self.knn_model, f)
        
        # Save symptom list
        with open(os.path.join(model_dir, 'symptoms.json'), 'w') as f:
            import json
            json.dump({'symptoms': self.all_symptoms}, f, indent=2)
        
        print(f"✅ Models saved to {model_dir}")
    
    def load_models(self, model_dir='../models/'):
        """Load pre-trained models from disk"""
        try:
            with open(os.path.join(model_dir, 'random_forest_model.pkl'), 'rb') as f:
                self.rf_model = pickle.load(f)
            
            with open(os.path.join(model_dir, 'knn_model.pkl'), 'rb') as f:
                self.knn_model = pickle.load(f)
            
            # Load symptom list
            with open(os.path.join(model_dir, 'symptoms.json'), 'r') as f:
                import json
                self.all_symptoms = json.load(f)['symptoms']
            
            print("✅ Models loaded from disk")
            return True
        except Exception as e:
            print(f"❌ Error loading models: {e}")
            return False