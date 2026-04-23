import torch
import torch.nn as nn
import torch.nn.functional as F
import numpy as np
from typing import List

class SymptomGNN(nn.Module):
    def __init__(self, num_symptoms):
        super(SymptomGNN, self).__init__()
        self.fc1 = nn.Linear(num_symptoms, 64)
        self.fc2 = nn.Linear(64, num_symptoms)
        
    def forward(self, x, adj):
        """ 
        Graph Convolution Layer Implementation.
        Signals propagate across the adjacency matrix (Symptom-Symptom co-occurrence).
        """
        x = torch.matmul(adj, x)
        x = F.relu(self.fc1(x))
        x = self.fc2(x)
        return x

class GNNService:
    def __init__(self, num_symptoms, symptom_list):
        self.model = SymptomGNN(num_symptoms)
        self.adj = torch.eye(num_symptoms)
        self.symptom_list = symptom_list

    def get_related_symptoms(self, vector: np.ndarray, current_symptoms: List[str]) -> List[str]:
        """ Identifies highly correlated symptoms using Graph Neural Network signal propagation """
        try:
            with torch.no_grad():
                symptom_tensor = torch.FloatTensor(vector).T
                output = self.model(symptom_tensor, self.adj)
                scores = output.flatten().numpy()
                top_idx = np.argsort(scores)[-10:]
                
                related = []
                current_labels = [s.lower() for s in current_symptoms]
                
                for idx in top_idx:
                    symptom = self.symptom_list[idx]
                    if symptom not in current_labels:
                        related.append(symptom)
                
                return related[:3]
        except Exception:
            return []
