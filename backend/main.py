"""
FastAPI backend for Katiba.

Endpoints:
  POST /ask     — search + AI answer in one shot (Gemini required)
  GET  /health  — liveness check
"""

from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from rag import retrieve, build_context, generate, _get_model, _get_collection


@asynccontextmanager
async def lifespan(app: FastAPI):
    print("Loading embedding model and ChromaDB collection...")
    _get_model()
    _get_collection()
    print("Ready.")
    yield


app = FastAPI(title="Katiba API", version="3.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class AskRequest(BaseModel):
    question: str


class ArticleResult(BaseModel):
    article: int
    title: str
    chapter: str
    part: str
    text: str


class AskResponse(BaseModel):
    question: str
    answer: Optional[str]      # AI plain-language answer (None if Gemini unavailable)
    articles: list[ArticleResult]


@app.post("/ask", response_model=AskResponse)
def ask(req: AskRequest):
    question = req.question.strip()
    if not question:
        raise HTTPException(status_code=400, detail="question cannot be empty")
    if len(question) > 1000:
        raise HTTPException(status_code=400, detail="question too long (max 1000 chars)")

    chunks = retrieve(question)
    articles = [
        ArticleResult(
            article=c["metadata"]["article"],
            title=c["metadata"]["title"],
            chapter=c["metadata"].get("chapter", ""),
            part=c["metadata"].get("part", ""),
            text=c["text"],
        )
        for c in chunks
    ]

    # Always call Gemini — gracefully return None if unavailable
    answer = None
    try:
        context = build_context(chunks)
        answer = generate(question, context)
    except Exception as e:
        print(f"Gemini unavailable: {e}")

    return AskResponse(question=question, answer=answer, articles=articles)


@app.get("/health")
def health():
    return {"status": "ok"}
