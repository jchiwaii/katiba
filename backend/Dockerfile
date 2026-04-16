# Build context must be the project root:
#   docker build -f backend/Dockerfile -t katiba-backend .
FROM python:3.11-slim

WORKDIR /app

COPY backend/requirements.txt .
# Install CPU-only torch first to avoid 2GB CUDA downloads
RUN pip install --no-cache-dir --timeout=120 --retries=5 \
    torch --index-url https://download.pytorch.org/whl/cpu
RUN pip install --no-cache-dir --timeout=120 --retries=5 -r requirements.txt

# Pre-download embedding model at build time — avoids slow cold starts on Cloud Run
ENV SENTENCE_TRANSFORMERS_HOME=/app/.cache/sentence_transformers
RUN python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('multi-qa-MiniLM-L6-cos-v1')"

# Backend source
COPY backend/ .

# Bake in pre-built vector data — no ingest.py needed at runtime
COPY data/chroma/ /data/chroma/
COPY data/chunks.json /data/chunks.json
COPY data/implementation_laws/chunks.json /data/implementation_laws/chunks.json

ENV PYTHONUNBUFFERED=1

# Cloud Run injects PORT (default 8080)
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8080}"]
