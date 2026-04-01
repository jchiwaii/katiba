# Katiba — Ask the Constitution of Kenya

AI-powered Q&A over the Kenya Constitution (2010). Ask any question in natural language and get grounded answers with exact Article citations, verbatim clause snippets, and plain-English explanations.

## Stack
- **Backend**: Python (FastAPI) + sentence-transformers + ChromaDB + Google Gemini Flash
- **Frontend**: Next.js 16 + Tailwind CSS
- **Cost**: $0/month (all free tiers)

## Quick Start

### 1. Get a free Gemini API key
Go to [aistudio.google.com](https://aistudio.google.com), create an API key — no credit card needed.

### 2. Backend
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt

# One-time ingestion (parse PDF → embed → store in ChromaDB)
python ingest.py

# Start the API server
GEMINI_API_KEY=your_key_here uvicorn main:app --reload
```

### 3. Frontend
```bash
cd frontend
cp .env.local.example .env.local
# BACKEND_URL defaults to http://localhost:8000

npm install
npm run dev
```

Open [localhost:3000](http://localhost:3000)

## Deployment

### Backend → Railway
1. Create a new Railway project, connect this repo
2. Set `Root Directory` to `backend`
3. Add env var `GEMINI_API_KEY`
4. Add a persistent volume mounted at `/data` for ChromaDB
5. Start command: `python ingest.py && uvicorn main:app --host 0.0.0.0 --port 8000`

### Frontend → Vercel
1. Connect repo to Vercel
2. Set `Root Directory` to `frontend`
3. Add env var `BACKEND_URL` = your Railway URL
4. Deploy

## How it works

```
User question
    → sentence-transformers embeds the question (CPU, free)
    → ChromaDB finds the 5 most relevant Articles
    → Gemini Flash generates a grounded answer using ONLY those articles
    → Response: Answer | References | Exact Text | Simple Explanation
```

Hallucination prevention: the LLM is forced to answer only from retrieved text, or say "I could not find a clear provision on this."
