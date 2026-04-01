FROM python:3.11-slim

WORKDIR /app

# Install system deps for PyMuPDF
RUN apt-get update && apt-get install -y --no-install-recommends \
    libmupdf-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Run ingestion on first deploy if chroma data doesn't exist
# In production, mount a persistent volume at /data/chroma
RUN mkdir -p /data/chroma /data

# Copy constitution PDF into container data dir
COPY ../data/ken127322.pdf /data/ken127322.pdf 2>/dev/null || true

ENV PYTHONUNBUFFERED=1

# Start: ingest if needed, then serve
CMD ["sh", "-c", "python ingest.py && uvicorn main:app --host 0.0.0.0 --port 8000"]
