"""
Model bootstrap for the HackSentinel prediction API.

At container startup, downloads the ML models + CVE lookup + RAG vector DB
from a cloud storage bucket (Cloudflare R2 recommended — 10 GB free tier).

Set MODELS_URL to the base URL of a bucket holding a `models.tar.gz` archive.
Expected archive layout after extraction:

    models/
        category_model_xgb.json
        category_model_lgbm.pkl
        category_model_lgbm.txt
        category_calibrator_xgb.pkl
        category_calibrator_lgbm.pkl
        severity_model.json
        feature_config.json
        feature_scaler.pkl
        tfidf_vectorizer.pkl
        tfidf_svd.pkl
        category_encoder.pkl
        severity_encoder.pkl
        specialized/
            <per-tech classifiers>
    merged_data/
        cve_lookup_index.json
    vector_db/              (optional — RAG search)
        ...

Local dev: skip this script and just symlink/copy the models folder into place.
The API is fully functional without vector_db/ (only RAG search is disabled).
"""

import os
import sys
import tarfile
import urllib.request
from pathlib import Path

MODELS_URL = os.environ.get("MODELS_URL", "").strip()
ARCHIVE_NAME = os.environ.get("MODELS_ARCHIVE", "models.tar.gz")
TARGET_DIR = Path(__file__).parent


def already_have_models() -> bool:
    """Skip download if the critical model files already exist on disk."""
    required = [
        "models/category_model_xgb.json",
        "models/severity_model.json",
        "models/tfidf_vectorizer.pkl",
    ]
    return all((TARGET_DIR / p).exists() for p in required)


def download_and_extract() -> None:
    if not MODELS_URL:
        print("[download_models] MODELS_URL not set — skipping.")
        print("[download_models] The API will fail to load unless models/ is already present.")
        return

    archive_url = MODELS_URL.rstrip("/") + "/" + ARCHIVE_NAME
    archive_path = TARGET_DIR / ARCHIVE_NAME

    print(f"[download_models] Fetching {archive_url}")
    try:
        urllib.request.urlretrieve(archive_url, archive_path)
    except Exception as e:
        print(f"[download_models] Download failed: {e}")
        sys.exit(1)

    print(f"[download_models] Extracting {archive_path}")
    try:
        with tarfile.open(archive_path, "r:gz") as tar:
            tar.extractall(TARGET_DIR)
    except Exception as e:
        print(f"[download_models] Extraction failed: {e}")
        sys.exit(1)

    try:
        archive_path.unlink()
    except OSError:
        pass

    print("[download_models] Models ready.")


if __name__ == "__main__":
    if already_have_models():
        print("[download_models] Models already present — skipping download.")
    else:
        download_and_extract()
