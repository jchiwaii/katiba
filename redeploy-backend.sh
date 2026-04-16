#!/usr/bin/env bash
# Redeploy only the Katiba backend to Google Cloud Run.
#
# Project number: 470296789410
# Project ID: gen-lang-client-0413572593
#
# Usage:
#   bash redeploy-backend.sh
#
# Optional:
#   export GCP_REGION=us-central1
#   export GEMINI_API_KEY=your_key_here
#
# If GEMINI_API_KEY is not exported, this script will try to read it from:
#   backend/.env

set -euo pipefail

GCP_PROJECT_ID="gen-lang-client-0413572593"
GCP_PROJECT_NUMBER="470296789410"
GCP_REGION="${GCP_REGION:-us-central1}"
REGISTRY="$GCP_REGION-docker.pkg.dev/$GCP_PROJECT_ID/katiba"
IMAGE="$REGISTRY/backend:latest"

if ! command -v gcloud >/dev/null 2>&1; then
  echo "ERROR: gcloud CLI is not installed or not on PATH." >&2
  exit 1
fi

if [[ -z "${GEMINI_API_KEY:-}" && -f "backend/.env" ]]; then
  GEMINI_API_KEY="$(
    python3 - <<'PY'
from pathlib import Path

for line in Path("backend/.env").read_text().splitlines():
    line = line.strip()
    if not line or line.startswith("#") or "=" not in line:
        continue
    key, value = line.split("=", 1)
    if key.strip() == "GEMINI_API_KEY":
        print(value.strip().strip('"').strip("'"))
        break
PY
  )"
fi

if [[ -z "${GEMINI_API_KEY:-}" ]]; then
  echo "ERROR: GEMINI_API_KEY is not set and was not found in backend/.env." >&2
  echo "Set it first: export GEMINI_API_KEY='your-key'" >&2
  exit 1
fi

required_paths=(
  "cloudbuild-backend.yaml"
  "backend/Dockerfile"
  "data/chroma"
  "data/chunks.json"
  "data/implementation_laws/chunks.json"
)

for path in "${required_paths[@]}"; do
  if [[ ! -e "$path" ]]; then
    echo "ERROR: Missing required deploy artifact: $path" >&2
    echo "If implementation laws are missing, run: backend/.venv/bin/python backend/ingest_implementation_laws.py" >&2
    exit 1
  fi
done

echo "==> Backend redeploy"
echo "    Project ID    : $GCP_PROJECT_ID"
echo "    Project number: $GCP_PROJECT_NUMBER"
echo "    Region        : $GCP_REGION"
echo "    Image         : $IMAGE"
echo ""

echo "[1/4] Setting active gcloud project..."
gcloud config set project "$GCP_PROJECT_ID" >/dev/null

echo "[2/4] Ensuring required Google Cloud services are enabled..."
gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com \
  --project "$GCP_PROJECT_ID"

echo "[3/4] Building and pushing backend image via Cloud Build..."
gcloud builds submit \
  --config cloudbuild-backend.yaml \
  --substitutions "_IMAGE=$IMAGE" \
  --project "$GCP_PROJECT_ID" \
  .

echo "[4/4] Deploying backend to Cloud Run..."
gcloud run deploy katiba-backend \
  --image "$IMAGE" \
  --platform managed \
  --region "$GCP_REGION" \
  --allow-unauthenticated \
  --memory 2Gi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 3 \
  --set-env-vars "GEMINI_API_KEY=$GEMINI_API_KEY" \
  --project "$GCP_PROJECT_ID"

BACKEND_URL="$(
  gcloud run services describe katiba-backend \
    --platform managed \
    --region "$GCP_REGION" \
    --project "$GCP_PROJECT_ID" \
    --format "value(status.url)"
)"

echo ""
echo "Backend deployed: $BACKEND_URL"
echo ""
echo "Health check:"
curl -fsS "$BACKEND_URL/health"
echo ""
echo ""
echo "Try a source-backed question:"
echo "curl -X POST '$BACKEND_URL/ask' \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{\"question\":\"How can a county governor be removed from office?\"}'"
