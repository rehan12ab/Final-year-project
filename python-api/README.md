# HackSentinel Python Prediction API

FastAPI service that powers passive vulnerability scanning:
TLS analysis, WAF/CDN detection, JS secret scanning, port scan, and an
XGBoost + LightGBM ensemble that predicts likely vulnerability categories.

Runs on port `8000`. Consumed by the Node backend (`../backend`) via
the `PYTHON_API_URL` environment variable.

---

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | Model load status + Ollama availability |
| POST | `/api/predict` | Raw prediction from text input |
| POST | `/api/scan/passive` | Full passive scan pipeline for a target URL |

---

## Local development

```bash
# 1. Install deps
pip install -r requirements.txt

# 2. Place model artifacts in ./models/
#    (see download_models.py for the expected layout)

# 3. Run
python predict_api.py
```

The API is reachable at `http://localhost:8000`.

The 400 MB+ of model artifacts is **not** in this repo — download them from
your cloud bucket or copy from your training environment.

---

## Deployment (Railway)

### 1. Set root directory
In the Railway service settings, set **Root Directory** to `python-api`.
Railway will build from `Dockerfile` automatically.

### 2. Set environment variables

| Variable | Example | Purpose |
|---|---|---|
| `MODELS_URL` | `https://models.hacksentinel.workers.dev` | Base URL of the bucket holding `models.tar.gz` |
| `MODELS_ARCHIVE` | `models.tar.gz` | (optional, default) archive filename |
| `PORT` | (auto) | Railway injects this |

### 3. Upload the models

Tar the models folder from your training environment:

```bash
cd Scrapping_Script
tar czf models.tar.gz models/ merged_data/cve_lookup_index.json
# optionally include vector_db/ for RAG search
```

Upload `models.tar.gz` to Cloudflare R2 (10 GB free tier) or any HTTPS bucket.
Copy the public URL to `MODELS_URL`.

On boot, `download_models.py` fetches and extracts the archive.
Subsequent restarts reuse the extracted files (skipped if already present).

### 4. Wire the backend to this service

In the Railway `backend` service, set:

```
PYTHON_API_URL=https://<your-python-service>.up.railway.app
```

---

## Boot sequence

```
container start
  → download_models.py            (~30s on first boot, skipped after)
  → uvicorn predict_api:app       (~15s to load models into RAM)
  → sentence-transformers download (~90 MB first boot only, cached in HF_HOME)
  → API ready on $PORT
```

Total first-boot time: ~2 minutes. Subsequent boots: ~30 seconds.

---

## Notes

- Ollama (for active AI scans) is **not** deployed here. Passive scan works
  fully without it. If you later add Ollama, set `OLLAMA_URL` on the backend.
- Redis is optional. Falls back to in-memory scan cache if unreachable.
- `vector_db/` is optional. Without it, RAG-based search is disabled but
  everything else works.
