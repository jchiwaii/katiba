"""
RAG pipeline:
  question → embed → ChromaDB search → Gemini answer → structured response

Uses hybrid retrieval: semantic (ChromaDB) + keyword (BM25-style with synonym expansion)
to handle vocabulary mismatches (e.g., "protest" → Article 37 "assemble/demonstrate").
"""

import json
import os
import re
from pathlib import Path

import chromadb
from chromadb.config import Settings
import google.generativeai as genai
from sentence_transformers import SentenceTransformer

from prompts import SYSTEM_PROMPT, ELI5_ADDITION

CHROMA_DIR = Path(__file__).parent.parent / "data" / "chroma"
CHUNKS_FILE = Path(__file__).parent.parent / "data" / "chunks.json"
COLLECTION_NAME = "constitution"
EMBEDDING_MODEL = "multi-qa-MiniLM-L6-cos-v1"
GEMINI_MODEL = "gemini-2.5-flash"
TOP_K = 6

# Legal synonym map: common plain-English terms → constitutional vocabulary
SYNONYMS: dict[str, list[str]] = {
    "protest": ["assemble", "demonstrate", "demonstration", "picket", "petition", "assembly"],
    "protests": ["assemble", "demonstrate", "picketing"],
    "march": ["assemble", "demonstrate", "picket"],
    "fire": ["remove", "removal", "dismiss", "impeach", "impeachment"],
    "fired": ["removed", "dismissed", "impeached"],
    "sack": ["remove", "dismiss"],
    "jail": ["detain", "arrest", "imprison", "custody"],
    "jailed": ["arrested", "detained", "imprisoned"],
    "prison": ["detained", "custody", "imprisonment"],
    "arrested": ["arrest", "detained", "custody", "apprehend"],
    "vote": ["election", "elect", "suffrage", "ballot", "franchise"],
    "voting": ["election", "suffrage", "electoral"],
    "land": ["property", "tenure", "ownership"],
    "speech": ["expression", "opinion", "freedom of expression"],
    "religion": ["conscience", "belief", "worship"],
    "healthcare": ["health", "medical"],
    "education": ["school", "learning", "right to education"],
    "death": ["capital punishment", "life"],
    "torture": ["inhumane", "degrading treatment"],
    "privacy": ["private", "search", "surveillance"],
    "citizenship": ["citizen", "nationality", "naturalisation"],
    "president": ["executive", "head of state", "commander in chief"],
    "governor": ["county governor", "county executive"],
    "senator": ["senate", "county representation"],
    "mp": ["member of parliament", "national assembly"],
    "courts": ["judiciary", "judicial", "magistrate"],
    "police": ["security forces", "national police"],
    "marriage": ["matrimonial", "spouse", "family"],
    "children": ["child", "minor", "juvenile"],
    "disabled": ["disability", "persons with disabilities"],
    "women": ["gender", "equality", "discrimination"],
}


# Singletons — loaded once at startup
_model: SentenceTransformer | None = None
_collection = None
_all_chunks: list[dict] | None = None


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


def _get_all_chunks() -> list[dict]:
    global _all_chunks
    if _all_chunks is None:
        with open(CHUNKS_FILE, encoding="utf-8") as f:
            _all_chunks = json.load(f)
    return _all_chunks


def _configure_gemini():
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY environment variable not set")
    genai.configure(api_key=api_key)


def _expand_query(question: str) -> set[str]:
    """Return a set of search terms from the question, with synonym expansion."""
    words = set(re.findall(r"\w+", question.lower()))
    expanded = set(words)
    for word in words:
        if word in SYNONYMS:
            for syn in SYNONYMS[word]:
                expanded.update(syn.lower().split())
    # Remove common stop words
    stops = {"i", "a", "the", "is", "in", "of", "to", "do", "have", "can", "my",
             "what", "are", "for", "on", "at", "be", "does", "did", "how", "who",
             "will", "was", "with", "and", "or", "not", "by", "from", "an", "it"}
    return expanded - stops


def keyword_search(question: str, top_k: int = 3) -> list[dict]:
    """BM25-style keyword search over chunks.json with synonym expansion."""
    terms = _expand_query(question)
    if not terms:
        return []

    chunks = _get_all_chunks()
    scored = []
    for chunk in chunks:
        search_text = f"{chunk.get('title','')} {chunk.get('text','')}".lower()
        score = sum(1 for t in terms if t in search_text)
        if score > 0:
            scored.append((score, chunk))

    scored.sort(reverse=True, key=lambda x: x[0])
    return [
        {
            "chunk_id": c["chunk_id"],
            "text": c["text"],
            "metadata": {
                "article": c["article"],
                "title": c["title"],
                "chapter": c.get("chapter", ""),
                "part": c.get("part", ""),
            },
            "distance": 1.0 - (score / len(terms)),  # pseudo-distance
        }
        for score, c in scored[:top_k]
    ]


def retrieve(question: str, top_k: int = TOP_K) -> list[dict]:
    """Hybrid retrieval: semantic + keyword, merged and deduplicated."""
    model = _get_model()
    collection = _get_collection()

    # Semantic search
    embedding = model.encode([question])[0].tolist()
    results = collection.query(
        query_embeddings=[embedding],
        n_results=top_k,
        include=["documents", "metadatas", "distances"],
    )
    semantic_chunks = [
        {
            "chunk_id": results["ids"][0][i],
            "text": results["documents"][0][i],
            "metadata": results["metadatas"][0][i],
            "distance": results["distances"][0][i],
        }
        for i in range(len(results["ids"][0]))
    ]

    # Keyword search
    keyword_chunks = keyword_search(question, top_k=3)

    # Merge: semantic first, then add keyword results not already included
    seen_ids = {c["chunk_id"] for c in semantic_chunks}
    merged = list(semantic_chunks)
    for kc in keyword_chunks:
        if kc["chunk_id"] not in seen_ids:
            merged.append(kc)
            seen_ids.add(kc["chunk_id"])

    return merged[:top_k + 2]  # allow a few extra to give LLM more context


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
    exact_text = extract(r'\*\*Exact Text:\*\*\s*[""]?(.*?)[""]?(?=\*\*Simple|\Z)')
    explanation = extract(r"\*\*Simple Explanation:\*\*\s*(.*?)(?=\Z)")

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
