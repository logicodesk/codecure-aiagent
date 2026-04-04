# Model Artifacts

This directory stores the generated Machine Learning models (`.pkl` files) utilized by the ToxScout AI backend.

Due to GitHub size limitations for large trained models, these artifacts are not checked into version control.

**To generate the models locally:**
1. Navigate to the root folder.
2. Ensure dependencies from `requirements.txt` are installed.
3. Run the training script: 
   ```bash
   python drug_toxicity/main.py
   ```
   This will train the models and automatically populate this directory with the `.pkl` files required by the API.
