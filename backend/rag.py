"""
RAG pipeline:
  question → embed → ChromaDB search → Gemini answer → structured response
"""

import os
import re
from pathlib import Path

import chromadb
from chromadb.config import Settings
import google.generativeai as genai
from sentence_transformers import SentenceTransformer

from prompts import SYSTEM_PROMPT, ELI5_ADDITION

CHROMA_DIR = Path(__file__).parent.parent / "data" / "chroma"
COLLECTION_NAME = "constitution"
EMBEDDING_MODEL = "all-MiniLM-L6-v2"
GEMINI_MODEL = "gemini-1.5-flash"
TOP_K = 5

# Singletons — loaded once at startup
_model: SentenceTransformer | None = None
_collection = None


def _get_model() -> SentenceTransformer:
    global _model
    if _model is None:
        _model = SentenceTransformer(EMBEDDING_MODEL)
    return _model


def _get_collection():
    global _collection
    if _collection is None:
        client = chromadb.PersistentClient(
            path=str(CHROMA_DIR),
            settings=Settings(anonymized_telemetry=False),
        )
        _collection = client.get_collection(COLLECTION_NAME)
    return _collection


def _configure_gemini():
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY environment variable not set")
    genai.configure(api_key=api_key)


def retrieve(question: str, top_k: int = TOP_K) -> list[dict]:
    """Return top_k most relevant article chunks for the question."""
    model = _get_model()
    collection = _get_collection()

    embedding = model.encode([question])[0].tolist()
    results = collection.query(
        query_embeddings=[embedding],
        n_results=top_k,
        include=["documents", "metadatas", "distances"],
    )

    chunks = []
    for i in range(len(results["ids"][0])):
        chunks.append(
            {
                "chunk_id": results["ids"][0][i],
                "text": results["documents"][0][i],
                "metadata": results["metadatas"][0][i],
                "distance": results["distances"][0][i],
            }
        )
    return chunks


def build_context(chunks: list[dict]) -> str:
    parts = []
    for c in chunks:
        meta = c["metadata"]
        header = f"Article {meta['article']} – {meta['title']}"
        if meta.get("chapter"):
            header += f" ({meta['chapter']})"
        parts.append(f"[{header}]\n{c['text']}")
    return "\n\n---\n\n".join(parts)


def generate(question: str, context: str, eli5: bool = False) -> str:
    _configure_gemini()
    system = SYSTEM_PROMPT
    if eli5:
        system += ELI5_ADDITION

    prompt = f"""{system}

--- CONSTITUTIONAL TEXT ---
{context}
--- END OF TEXT ---

Question: {question}
"""

    model = genai.GenerativeModel(
        GEMINI_MODEL,
        generation_config=genai.GenerationConfig(
            temperature=0.1,
            max_output_tokens=1024,
        ),
    )
    response = model.generate_content(prompt)
    return response.text


def parse_response(text: str) -> dict:
    """Extract structured fields from the LLM response."""
    def extract(pattern: str) -> str:
        m = re.search(pattern, text, re.DOTALL | re.IGNORECASE)
        return m.group(1).strip() if m else ""

    answer = extract(r"\*\*Answer:\*\*\s*(.*?)(?=\*\*References|\*\*Exact|\Z)")
    references_raw = extract(r"\*\*References:\*\*\s*(.*?)(?=\*\*Exact|\*\*Simple|\Z)")
    exact_text = extract(r"\*\*Exact Text:\*\*\s*[\""]?(.*?)[\""]?(?=\*\*Simple|\Z)")
    explanation = extract(r"\*\*Simple Explanation:\*\*\s*(.*?)(?=\Z)")

    # Parse reference lines into list
    references = []
    for line in references_raw.split("\n"):
        line = line.strip().lstrip("-•* ").strip()
        if line:
            references.append(line)

    return {
        "answer": answer,
        "references": references,
        "exact_text": exact_text,
        "explanation": explanation,
        "raw": text,
    }


def answer(question: str, eli5: bool = False) -> dict:
    chunks = retrieve(question)
    context = build_context(chunks)
    raw = generate(question, context, eli5=eli5)
    result = parse_response(raw)
    result["chunks_used"] = [
        {
            "article": c["metadata"]["article"],
            "title": c["metadata"]["title"],
            "text": c["text"][:300] + "..." if len(c["text"]) > 300 else c["text"],
        }
        for c in chunks
    ]
    return result
