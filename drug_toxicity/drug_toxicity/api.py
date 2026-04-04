from fastapi import FastAPI
from model_io import predict_toxicity

app = FastAPI()

@app.get("/")
def home():
    return {"message": "Drug Toxicity API is running 🚀"}

@app.get("/predict")
def predict(smiles: str):
    result = predict_toxicity(smiles, model_name="Stacking_Ensemble")
    return result