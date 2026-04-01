"""
FastAPI backend for Katiba.

Endpoints:
  POST /ask   — ask a question about the Kenya Constitution
  GET  /health — liveness check
"""

from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from rag import answer as rag_answer, _get_model, _get_collection


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Warm up models at startup so first request isn't slow
    print("Loading embedding model and ChromaDB collection...")
    _get_model()
    _get_collection()
    print("Ready.")
    yield


app = FastAPI(title="Katiba API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Tighten to your Vercel domain in production
    allow_methods=["*"],
    allow_headers=["*"],
)


class AskRequest(BaseModel):
    question: str
    eli5: Optional[bool] = False


class AskResponse(BaseModel):
    answer: str
    references: list[str]
    exact_text: str
    explanation: str
    chunks_used: list[dict]


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/ask", response_model=AskResponse)
def ask(req: AskRequest):
    question = req.question.strip()
    if not question:
        raise HTTPException(status_code=400, detail="question cannot be empty")
    if len(question) > 1000:
        raise HTTPException(status_code=400, detail="question too long (max 1000 chars)")

    result = rag_answer(question, eli5=req.eli5 or False)
    return AskResponse(
        answer=result.get("answer", ""),
        references=result.get("references", []),
        exact_text=result.get("exact_text", ""),
        explanation=result.get("explanation", ""),
        chunks_used=result.get("chunks_used", []),
    )
