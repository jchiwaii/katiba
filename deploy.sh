#!/bin/bash
# Deploys Katiba to Google Cloud Run (backend + frontend).
#
# Required env vars before running:
#   export GCP_PROJECT_ID=your-project-id
#   export GEMINI_API_KEY=your-gemini-api-key
#
# Optional:
#   export GCP_REGION=us-central1   (default: us-central1)
#
# Usage: bash deploy.sh

set -euo pipefail

: "${GCP_PROJECT_ID:?ERROR: Set GCP_PROJECT_ID before running}"
: "${GEMINI_API_KEY:?ERROR: Set GEMINI_API_KEY before running}"

REGION="${GCP_REGION:-us-central1}"
REGISTRY="$REGION-docker.pkg.dev/$GCP_PROJECT_ID/katiba"

echo "==> Project : $GCP_PROJECT_ID"
echo "==> Region  : $REGION"
echo "==> Registry: $REGISTRY"
echo ""

# ── Enable required APIs ───────────────────────────────────────────────────────
echo "[1/6] Enabling Cloud Run + Artifact Registry + Cloud Build APIs..."
gcloud services enable run.googleapis.com artifactregistry.googleapis.com cloudbuild.googleapis.com \
  --project "$GCP_PROJECT_ID"

# ── Create Artifact Registry repo (idempotent) ────────────────────────────────
echo "[2/6] Creating Artifact Registry repo 'katiba' (if not exists)..."
gcloud artifacts repositories create katiba \
  --repository-format=docker \
  --location="$REGION" \
  --project="$GCP_PROJECT_ID" 2>/dev/null || true


# ── Build + push backend via Cloud Build ──────────────────────────────────────
echo "[3/6] Building backend image on Google Cloud Build..."
gcloud builds submit \
  --config cloudbuild-backend.yaml \
  --substitutions "_IMAGE=$REGISTRY/backend:latest" \
  --project "$GCP_PROJECT_ID" \
  .

# ── Deploy backend to Cloud Run ────────────────────────────────────────────────
echo "[4/6] Deploying backend to Cloud Run..."
gcloud run deploy katiba-backend \
  --image "$REGISTRY/backend:latest" \
  --platform managed \
  --region "$REGION" \
  --allow-unauthenticated \
  --memory 2Gi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 3 \
  --set-env-vars "GEMINI_API_KEY=$GEMINI_API_KEY" \
  --project "$GCP_PROJECT_ID"

BACKEND_URL=$(gcloud run services describe katiba-backend \
  --platform managed \
  --region "$REGION" \
  --project "$GCP_PROJECT_ID" \
  --format "value(status.url)")

echo "    Backend deployed: $BACKEND_URL"

# ── Build + push frontend via Cloud Build ─────────────────────────────────────
echo "[5/6] Building frontend image on Google Cloud Build..."
gcloud builds submit \
  --config cloudbuild-frontend.yaml \
  --substitutions "_IMAGE=$REGISTRY/frontend:latest" \
  --project "$GCP_PROJECT_ID" \
  .

# ── Deploy frontend to Cloud Run ───────────────────────────────────────────────
echo "[6/6] Deploying frontend to Cloud Run..."
gcloud run deploy katiba-frontend \
  --image "$REGISTRY/frontend:latest" \
  --platform managed \
  --region "$REGION" \
  --allow-unauthenticated \
  --memory 512Mi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 3 \
  --set-env-vars "BACKEND_URL=$BACKEND_URL" \
  --project "$GCP_PROJECT_ID"

FRONTEND_URL=$(gcloud run services describe katiba-frontend \
  --platform managed \
  --region "$REGION" \
  --project "$GCP_PROJECT_ID" \
  --format "value(status.url)")

echo ""
echo "=========================================="
echo " Deployment complete!"
echo "=========================================="
echo " Frontend : $FRONTEND_URL"
echo " Backend  : $BACKEND_URL"
echo "=========================================="
