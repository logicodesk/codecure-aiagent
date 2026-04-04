# ToxAI — Drug Toxicity Predictor

Frontend and backend are combined into a single server.
One command runs everything at `http://localhost:8000`.

---

## Setup

### 1. Install all dependencies

```bash
pip install -r requirements.txt
```

### 2. Train the ML models (one-time)

```bash
python drug_toxicity/main.py
```

Trains on `tox21.csv`, saves models to `drug_toxicity/models/`. Takes ~2–5 min.

### 3. Build the frontend (one-time, or after UI changes)

```bash
cd frontend
npm install
npm run build
```

### 4. Start the combined server

```bash
uvicorn backend.api:app --reload --port 8000
```

Open `http://localhost:8000` — the React UI is served directly by FastAPI.

---

## How it works

```
http://localhost:8000
  ├── /predict        POST  — toxicity prediction
  ├── /examples       GET   — example molecules
  ├── /models         GET   — loaded model names
  ├── /health         GET   — server health check
  └── /*              GET   — serves React SPA (frontend/dist)
```

FastAPI mounts `frontend/dist` as static files and serves `index.html` for all
non-API routes, so React client-side routing works correctly.

---

## Development mode (hot reload UI)

If you're actively editing the frontend, run both in separate terminals:

```bash
# Terminal 1 — backend
uvicorn backend.api:app --reload --port 8000

# Terminal 2 — frontend dev server (proxies API to :8000)
cd frontend && npm run dev
```

Frontend dev server runs at `http://localhost:3000` with hot reload.
After finishing UI changes, rebuild with `npm run build` and use `:8000` again.

---

## Project structure

```
├── requirements.txt             # All Python dependencies (ML + server)
├── tox21.csv                    # Training dataset
├── drug_toxicity/               # ML pipeline
│   ├── main.py                  # Train all models
│   ├── config.py                # Settings
│   ├── features.py              # RDKit feature extraction (439 features)
│   ├── models/                  # Saved .pkl files
│   └── plots/                   # Generated plots
├── backend/
│   └── api.py                   # FastAPI — API + serves frontend/dist
└── frontend/
    ├── dist/                    # Built React app (served by FastAPI)
    └── src/                     # React source
```
