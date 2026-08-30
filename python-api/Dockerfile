FROM python:3.11-slim

# System deps for lightgbm, xgboost, chromadb, and building wheels
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libgomp1 \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install python deps first (better layer caching)
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# HuggingFace model cache lives here — downloads on first boot (~90 MB)
ENV HF_HOME=/app/.cache/hf
ENV TRANSFORMERS_CACHE=/app/.cache/hf

# Railway injects PORT; default to 8000 for local docker runs
ENV PORT=8000
EXPOSE 8000

# Download the ML models from cloud storage, then start uvicorn.
# download_models.py is a no-op if models/ already exists.
CMD python download_models.py && uvicorn predict_api:app --host 0.0.0.0 --port ${PORT}
