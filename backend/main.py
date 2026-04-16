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

from rag import retrieve, build_context, generate, answer as explain_answer, _get_model, _get_collection


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


class ExplainRequest(BaseModel):
    question: str
    eli5: bool = False


class ArticleResult(BaseModel):
    article: Optional[int] = None
    title: str
    chapter: str = ""
    part: str = ""
    text: str
    source_type: str = "constitution"
    source_title: Optional[str] = None
    citation: Optional[str] = None
    source_url: Optional[str] = None
    section_title: Optional[str] = None
    status: Optional[str] = None


class AskResponse(BaseModel):
    question: str
    answer: Optional[str]      # AI plain-language answer (None if Gemini unavailable)
    articles: list[ArticleResult]


class ExplainResponse(BaseModel):
    answer: str
    references: list[str]
    exact_text: str
    explanation: str


def _validate_question(question: str) -> str:
    cleaned = question.strip()
    if not cleaned:
        raise HTTPException(status_code=400, detail="question cannot be empty")
    if len(cleaned) > 1000:
        raise HTTPException(status_code=400, detail="question too long (max 1000 chars)")
    return cleaned


def _format_reference(meta: dict) -> str:
    if meta.get("source_type") == "implementation_law":
        title = meta.get("source_title") or meta.get("title", "Implementation law")
        citation = meta.get("citation")
        section = meta.get("section_title")
        parts = [title]
        if citation:
            parts.append(citation)
        if section:
            parts.append(section)
        return " - ".join(parts)
    return f"Article {meta.get('article')}: {meta.get('title', '')}".strip()


@app.post("/ask", response_model=AskResponse)
def ask(req: AskRequest):
    question = _validate_question(req.question)

    chunks = retrieve(question)
    articles = [
        ArticleResult(
            article=c["metadata"].get("article"),
            title=c["metadata"].get("title") or c["metadata"].get("source_title", ""),
            chapter=c["metadata"].get("chapter", ""),
            part=c["metadata"].get("part", ""),
            text=c["text"],
            source_type=c["metadata"].get("source_type", "constitution"),
            source_title=c["metadata"].get("source_title"),
            citation=c["metadata"].get("citation"),
            source_url=c["metadata"].get("source_url"),
            section_title=c["metadata"].get("section_title"),
            status=c["metadata"].get("status"),
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


@app.post("/explain", response_model=ExplainResponse)
def explain(req: ExplainRequest):
    question = _validate_question(req.question)

    try:
        result = explain_answer(question, eli5=req.eli5)
        return ExplainResponse(
            answer=result.get("answer", ""),
            references=result.get("references", []),
            exact_text=result.get("exact_text", ""),
            explanation=result.get("explanation", ""),
        )
    except Exception as e:
        print(f"Gemini unavailable: {e}")
        chunks = retrieve(question)
        references = [_format_reference(c["metadata"]) for c in chunks[:5]]
        exact_text = chunks[0]["text"][:1000] if chunks else ""
        explanation = (
            "AI explanation is unavailable right now, but the relevant source text "
            "and references are still shown."
        )
        return ExplainResponse(
            answer="",
            references=references,
            exact_text=exact_text,
            explanation=explanation,
        )


@app.get("/health")
def health():
    return {"status": "ok"}
