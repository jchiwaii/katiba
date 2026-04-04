"""
FastAPI backend for Katiba.

Endpoints:
  POST /ask      — search the constitution (NO AI, free, instant)
  POST /explain  — AI explanation of results (Gemini, only on demand)
  GET  /health   — liveness check
"""

from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from rag import retrieve, build_context, generate, parse_response, _get_model, _get_collection


@asynccontextmanager
async def lifespan(app: FastAPI):
    print("Loading embedding model and ChromaDB collection...")
    _get_model()
    _get_collection()
    print("Ready.")
    yield


app = FastAPI(title="Katiba API", version="2.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── /ask — pure search, no AI ──────────────────────────────────────────────────

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
    return AskResponse(question=question, articles=articles)


# ── /explain — AI explanation, only called when user requests it ───────────────

class ExplainRequest(BaseModel):
    question: str
    eli5: Optional[bool] = False


class ExplainResponse(BaseModel):
    answer: str
    references: list[str]
    exact_text: str
    explanation: str


@app.post("/explain", response_model=ExplainResponse)
def explain(req: ExplainRequest):
    question = req.question.strip()
    if not question:
        raise HTTPException(status_code=400, detail="question cannot be empty")
    if len(question) > 1000:
        raise HTTPException(status_code=400, detail="question too long (max 1000 chars)")

    chunks = retrieve(question)
    context = build_context(chunks)
    raw = generate(question, context, eli5=req.eli5 or False)
    result = parse_response(raw)

    return ExplainResponse(
        answer=result.get("answer", ""),
        references=result.get("references", []),
        exact_text=result.get("exact_text", ""),
        explanation=result.get("explanation", ""),
    )


@app.get("/health")
def health():
    return {"status": "ok"}
