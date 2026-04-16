"""
RAG pipeline:
  question → hybrid retrieve → Gemini answer → structured response

Hybrid retrieval: semantic (ChromaDB cosine) + keyword (synonym-expanded BM25-style)
ensures vocabulary mismatches ("protest" → "assemble") are handled robustly.
"""

import json
import os
import re
from pathlib import Path

import chromadb
from chromadb.config import Settings
import google.generativeai as genai
from sentence_transformers import SentenceTransformer

from prompts import SYSTEM_PROMPT

CHROMA_DIR = Path(__file__).parent.parent / "data" / "chroma"
CHUNKS_FILE = Path(__file__).parent.parent / "data" / "chunks.json"
IMPLEMENTATION_CHUNKS_FILE = Path(__file__).parent.parent / "data" / "implementation_laws" / "chunks.json"
COLLECTION_NAME = "constitution"
IMPLEMENTATION_COLLECTION_NAME = "implementation_laws"
EMBEDDING_MODEL = "multi-qa-MiniLM-L6-cos-v1"
GEMINI_MODEL = "gemini-2.5-flash"
SEMANTIC_TOP_K = 6
KEYWORD_TOP_K = 3
IMPLEMENTATION_TOP_K = 3

# Plain-English → constitutional vocabulary synonyms
# Covers the most common vocabulary mismatches for a Kenyan user
SYNONYMS: dict[str, list[str]] = {
    # Civil/political rights
    "protest": ["assemble", "demonstrate", "demonstration", "picket", "petition", "assembly"],
    "protests": ["demonstrate", "picket", "assembly", "assemblies"],
    "march": ["demonstrate", "picket", "assemble"],
    "rally": ["assemble", "assembly", "demonstrate"],
    "strike": ["assemble", "demonstrate", "labour"],
    "speech": ["expression", "freedom of expression", "opinion"],
    "talk": ["expression", "speech"],
    "press": ["media", "freedom of media", "expression"],
    "newspaper": ["media", "freedom of media"],
    "religion": ["conscience", "belief", "worship", "faith"],
    "church": ["religion", "belief", "worship"],
    "mosque": ["religion", "belief", "worship"],
    "pray": ["worship", "religion", "conscience"],
    "vote": ["election", "elect", "suffrage", "ballot", "franchise"],
    "voting": ["election", "suffrage", "electoral", "ballot"],
    "election": ["vote", "suffrage", "electoral"],
    "party": ["political party", "political parties"],
    # Rights of accused/arrested
    "arrested": ["arrest", "detained", "custody", "apprehend"],
    "detention": ["detained", "arrested", "custody", "imprisonment"],
    "jail": ["detain", "arrest", "imprison", "custody", "imprisoned"],
    "jailed": ["arrested", "detained", "imprisoned", "custody"],
    "prison": ["detained", "custody", "imprisonment", "remand"],
    "bail": ["bond", "remand", "pretrial"],
    "lawyer": ["advocate", "counsel", "legal representation", "legal aid"],
    "attorney": ["advocate", "counsel", "legal representation"],
    "legal representation": ["advocate", "counsel", "assigned", "legal aid", "arrested"],
    "represent": ["advocate", "counsel", "legal representation", "arrested"],
    "solicitor": ["advocate", "counsel", "legal representation"],
    "court": ["judiciary", "judicial", "magistrate", "tribunal"],
    "judge": ["judiciary", "judicial", "chief justice"],
    "trial": ["fair hearing", "hearing", "judicial process"],
    "sue": ["legal action", "enforce rights", "remedy"],
    # Search and privacy
    "search": ["privacy", "searched", "home", "property", "person"],
    "searched": ["privacy", "home", "property", "search"],
    "surveillance": ["privacy", "information", "intercept"],
    "wiretap": ["privacy", "intercept", "communication"],
    "intercept": ["privacy", "communication", "information"],
    # Government/leadership removal
    "fire": ["remove", "removal", "dismiss", "impeach", "impeachment"],
    "fired": ["removed", "dismissed", "impeached", "removed from office"],
    "sack": ["remove", "dismiss", "impeach"],
    "resign": ["resignation", "vacate", "vacancy"],
    "remove": ["removal", "impeach", "dismiss", "vacate"],
    "impeach": ["impeachment", "removal", "censure"],
    # Land and property
    "land": ["property", "tenure", "ownership", "title", "freehold", "leasehold"],
    "property": ["land", "ownership", "title deed"],
    "house": ["housing", "shelter", "residence", "adequate housing", "home", "property"],
    "home": ["house", "residence", "privacy", "property", "searched"],
    "evict": ["eviction", "land", "property"],
    # Health, education, welfare
    "hospital": ["health", "medical", "healthcare"],
    "healthcare": ["health", "medical", "highest attainable standard of health"],
    "doctor": ["health", "medical"],
    "school": ["education", "learning", "basic education"],
    "education": ["school", "learning", "basic education"],
    "water": ["clean water", "sanitation", "basic needs"],
    "food": ["nutrition", "basic needs", "adequate food"],
    "unemployed": ["labour", "work", "employment"],
    "work": ["labour", "employment", "fair remuneration"],
    # Family
    "marry": ["marriage", "matrimonial", "spouse", "family"],
    "marriage": ["matrimonial", "spouse", "family", "married"],
    "divorce": ["marriage", "matrimonial", "spouse", "family"],
    "children": ["child", "minor", "juvenile", "best interests"],
    "child": ["children", "minor", "juvenile", "best interests"],
    "orphan": ["child", "children", "family"],
    "parent": ["family", "children", "parental"],
    # Vulnerable groups
    "disabled": ["disability", "persons with disabilities"],
    "disability": ["persons with disabilities", "disabled"],
    "women": ["gender", "equality", "discrimination", "woman"],
    "gender": ["equality", "discrimination", "women"],
    "minority": ["marginalised", "marginalized", "minority communities"],
    "youth": ["young persons", "age", "children"],
    "elderly": ["older members", "older persons"],
    # Government structures
    "president": ["executive", "head of state", "commander in chief", "state house"],
    "governor": ["county governor", "county executive"],
    "senator": ["senate", "county representation"],
    "mp": ["member of parliament", "national assembly", "member of national assembly"],
    "parliament": ["national assembly", "senate", "legislature", "legislative"],
    "cabinet": ["executive", "cabinet secretaries", "ministers"],
    "police": ["national police service", "security forces", "police service"],
    "army": ["kenya defence forces", "military", "national security"],
    "government": ["state", "executive", "national government"],
    "county": ["devolution", "devolved", "county government"],
    # Finance
    "tax": ["taxation", "revenue", "consolidated fund"],
    "budget": ["appropriation", "consolidated fund", "finance"],
    "corruption": ["integrity", "ethics", "accountability", "anti-corruption"],
    # Death penalty / torture
    "death penalty": ["capital punishment", "right to life"],
    "torture": ["inhumane", "degrading", "cruel", "inhuman", "freedom and security", "fundamental"],
    "tortured": ["inhumane", "degrading", "cruel", "inhuman", "torture", "fundamental"],
    "cruel": ["inhumane", "degrading", "torture", "inhuman", "freedom and security"],
    "inhuman": ["torture", "degrading", "cruel", "fundamental"],
    "kill": ["right to life", "life"],
    "privacy": ["private", "search", "surveillance", "information"],
    "spy": ["privacy", "surveillance"],
    # Citizenship
    "citizenship": ["citizen", "nationality", "naturalisation", "naturalization"],
    "foreigner": ["citizen", "citizenship", "nationality"],
    "deported": ["citizenship", "expelled", "resident"],
}

STOP_WORDS = {
    "i", "a", "an", "the", "is", "in", "of", "to", "do", "have", "can", "my",
    "what", "are", "for", "on", "at", "be", "does", "did", "how", "who", "which",
    "will", "was", "with", "and", "or", "not", "by", "from", "it", "this", "that",
    "they", "we", "he", "she", "you", "me", "him", "her", "us", "them", "if",
    "kenya", "kenyan", "constitution", "constitutional", "rights", "right", "under",
    "about", "any", "all", "get", "has", "had", "been", "would", "could", "should",
}

# Singletons — loaded once at startup
_model: SentenceTransformer | None = None
_collection = None
_implementation_collection = None
_implementation_collection_unavailable = False
_all_chunks: list[dict] | None = None
_implementation_chunks: list[dict] | None = None


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


def _get_implementation_collection():
    """Return the optional implementation-law collection if it has been ingested."""
    global _implementation_collection, _implementation_collection_unavailable
    if _implementation_collection_unavailable:
        return None
    if _implementation_collection is None:
        client = chromadb.PersistentClient(
            path=str(CHROMA_DIR),
            settings=Settings(anonymized_telemetry=False),
        )
        try:
            _implementation_collection = client.get_collection(IMPLEMENTATION_COLLECTION_NAME)
        except Exception:
            _implementation_collection_unavailable = True
            return None
    return _implementation_collection


def _get_main_chunks() -> list[dict]:
    """Load only main constitution chunks (not schedules) from chunks.json."""
    global _all_chunks
    if _all_chunks is None:
        with open(CHUNKS_FILE, encoding="utf-8") as f:
            data = json.load(f)
        _all_chunks = [c for c in data if not c.get("is_schedule", False)]
    return _all_chunks


def _get_implementation_chunks() -> list[dict]:
    """Load cached implementation-law chunks when available."""
    global _implementation_chunks
    if _implementation_chunks is None:
        if not IMPLEMENTATION_CHUNKS_FILE.exists():
            _implementation_chunks = []
        else:
            with open(IMPLEMENTATION_CHUNKS_FILE, encoding="utf-8") as f:
                _implementation_chunks = json.load(f)
    return _implementation_chunks


def _configure_gemini():
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY environment variable not set")
    genai.configure(api_key=api_key)


def _expand_terms(question: str) -> set[str]:
    """Tokenize question and expand with synonyms."""
    words = set(re.findall(r"\w+", question.lower()))
    expanded = set(words)
    for word in words:
        if word in SYNONYMS:
            for syn in SYNONYMS[word]:
                expanded.update(syn.lower().split())
    # Also try bigrams
    word_list = re.findall(r"\w+", question.lower())
    for j in range(len(word_list) - 1):
        bigram = f"{word_list[j]} {word_list[j+1]}"
        if bigram in SYNONYMS:
            for syn in SYNONYMS[bigram]:
                expanded.update(syn.lower().split())
    return expanded - STOP_WORDS


def keyword_search(question: str, top_k: int = KEYWORD_TOP_K) -> list[dict]:
    """Score chunks by keyword overlap (with synonym expansion)."""
    terms = _expand_terms(question)
    if not terms:
        return []

    chunks = _get_main_chunks()
    scored = []
    for chunk in chunks:
        search_text = (
            f"article {chunk['article']} {chunk.get('title','')} {chunk.get('text','')} "
            f"{chunk.get('chapter','')} {chunk.get('part','')}"
        ).lower()
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
                "source_type": "constitution",
            },
            "distance": max(0.0, 1.0 - score / max(len(terms), 1)),
        }
        for score, c in scored[:top_k]
    ]


def implementation_keyword_search(question: str, top_k: int = IMPLEMENTATION_TOP_K) -> list[dict]:
    """Keyword search over ordinary implementation Acts."""
    terms = _expand_terms(question)
    if not terms:
        return []

    chunks = _get_implementation_chunks()
    scored = []
    for chunk in chunks:
        search_text = (
            f"{chunk.get('source_title','')} {chunk.get('citation','')} "
            f"{chunk.get('category','')} {chunk.get('constitution_articles','')} "
            f"{chunk.get('section_title','')} {chunk.get('text','')}"
        ).lower()
        score = sum(1 for t in terms if t in search_text)
        if score > 0:
            scored.append((score, chunk))

    scored.sort(reverse=True, key=lambda x: x[0])
    return [
        {
            "chunk_id": c["chunk_id"],
            "text": c["text"],
            "metadata": {
                "source_id": c.get("source_id", ""),
                "source_title": c.get("source_title", ""),
                "title": c.get("source_title", ""),
                "citation": c.get("citation", ""),
                "source_url": c.get("source_url", ""),
                "source_type": c.get("source_type", "implementation_law"),
                "status": c.get("status", "current_law"),
                "category": c.get("category", ""),
                "constitution_articles": c.get("constitution_articles", ""),
                "section_title": c.get("section_title", ""),
            },
            "distance": max(0.0, 1.0 - score / max(len(terms), 1)),
        }
        for score, c in scored[:top_k]
    ]


def retrieve_implementation_laws(question: str, embedding: list[float]) -> list[dict]:
    """Retrieve implementation-law chunks from semantic and keyword indexes."""
    semantic: list[dict] = []
    collection = _get_implementation_collection()
    if collection is not None:
        results = collection.query(
            query_embeddings=[embedding],
            n_results=IMPLEMENTATION_TOP_K,
            include=["documents", "metadatas", "distances"],
        )
        if results.get("ids") and results["ids"][0]:
            semantic = [
                {
                    "chunk_id": results["ids"][0][i],
                    "text": results["documents"][0][i],
                    "metadata": results["metadatas"][0][i],
                    "distance": results["distances"][0][i],
                }
                for i in range(len(results["ids"][0]))
            ]

    keyword = implementation_keyword_search(question)
    seen = {c["chunk_id"] for c in semantic}
    merged = list(semantic)
    for kc in keyword:
        if kc["chunk_id"] not in seen:
            merged.append(kc)
            seen.add(kc["chunk_id"])
    return merged[:IMPLEMENTATION_TOP_K]


def retrieve(question: str) -> list[dict]:
    """Hybrid retrieval: semantic + keyword, merged and deduplicated."""
    model = _get_model()
    collection = _get_collection()

    # 1. Semantic search
    embedding = model.encode([question])[0].tolist()
    results = collection.query(
        query_embeddings=[embedding],
        n_results=SEMANTIC_TOP_K,
        include=["documents", "metadatas", "distances"],
    )
    semantic = [
        {
            "chunk_id": results["ids"][0][i],
            "text": results["documents"][0][i],
            "metadata": results["metadatas"][0][i],
            "distance": results["distances"][0][i],
        }
        for i in range(len(results["ids"][0]))
    ]

    # 2. Keyword search
    keyword = keyword_search(question)

    # 3. Merge: semantic first, keyword fills gaps
    seen = {c["chunk_id"] for c in semantic}
    constitution_results = list(semantic)
    for kc in keyword:
        if kc["chunk_id"] not in seen:
            constitution_results.append(kc)
            seen.add(kc["chunk_id"])

    # 4. Add ordinary implementation laws after the leading constitutional sources.
    implementation = retrieve_implementation_laws(question, embedding)
    merged = []
    seen = set()
    for c in constitution_results[:4] + implementation + constitution_results[4:]:
        if c["chunk_id"] not in seen:
            merged.append(c)
            seen.add(c["chunk_id"])

    return merged


def build_context(chunks: list[dict]) -> str:
    parts = []
    for c in chunks:
        meta = c["metadata"]
        if meta.get("source_type") == "implementation_law":
            header = f"Implementation Law: {meta.get('source_title') or meta.get('title', 'Unknown law')}"
            if meta.get("citation"):
                header += f" ({meta['citation']})"
            if meta.get("section_title"):
                header += f"\n{meta['section_title']}"
            if meta.get("constitution_articles"):
                header += f"\nLinked Constitution Article(s): {meta['constitution_articles']}"
        else:
            header = f"Constitution Article {meta['article']} – {meta['title']}"
            if meta.get("chapter"):
                header += f"\n{meta['chapter']}"
        parts.append(f"[{header}]\n{c['text']}")
    return "\n\n---\n\n".join(parts)


def generate(question: str, context: str) -> str:
    _configure_gemini()

    prompt = f"""{SYSTEM_PROMPT}

--- PROVIDED SOURCES ---
{context}
--- END OF SOURCES ---

Question: {question}
"""
    model = genai.GenerativeModel(
        GEMINI_MODEL,
        generation_config=genai.GenerationConfig(
            temperature=0.1,
            max_output_tokens=2048,
        ),
    )
    response = model.generate_content(prompt)
    return response.text


def generate_explanation(question: str, context: str, eli5: bool = False) -> str:
    _configure_gemini()

    style = (
        "Explain it very simply, using short everyday language."
        if eli5
        else "Explain it clearly and directly for a non-lawyer."
    )
    prompt = f"""{SYSTEM_PROMPT}

Return exactly these sections:
Answer:
References:
Exact Text:
Simple Explanation:

{style}

--- PROVIDED SOURCES ---
{context}
--- END OF SOURCES ---

Question: {question}
"""
    model = genai.GenerativeModel(
        GEMINI_MODEL,
        generation_config=genai.GenerationConfig(
            temperature=0.1,
            max_output_tokens=2048,
        ),
    )
    response = model.generate_content(prompt)
    return response.text


def parse_response(raw: str) -> dict:
    """
    Extract structured fields from LLM output.
    Handles multiple possible formatting variations from the model.
    """
    def extract(patterns: list[str]) -> str:
        for pat in patterns:
            m = re.search(pat, raw, re.DOTALL | re.IGNORECASE)
            if m:
                return m.group(1).strip()
        return ""

    # Answer field — try bold header first, then plain header
    answer = extract([
        r"\*\*Answer:\*\*\s*(.*?)(?=\*\*References|\*\*Exact|\*\*Simple|\Z)",
        r"Answer:\s*(.*?)(?=References:|Exact Text:|Simple Explanation:|\Z)",
    ])

    # References block
    references_raw = extract([
        r"\*\*References:\*\*\s*(.*?)(?=\*\*Exact|\*\*Simple|\Z)",
        r"References:\s*(.*?)(?=Exact Text:|Simple Explanation:|\Z)",
    ])

    # Exact text — strip surrounding quotes if present
    exact_text = extract([
        r'\*\*Exact Text:\*\*\s*[""""]?(.*?)[""""]?\s*(?=\*\*Simple|\Z)',
        r'Exact Text:\s*[""""]?(.*?)[""""]?\s*(?=Simple Explanation:|\Z)',
    ])
    # Clean up stray quote characters at boundaries
    exact_text = exact_text.strip('""\u201c\u201d\u2018\u2019')

    # Simple explanation
    explanation = extract([
        r"\*\*Simple Explanation:\*\*\s*(.*?)(?=\Z)",
        r"Simple Explanation:\s*(.*?)(?=\Z)",
    ])

    # Parse references into a clean list
    references = []
    for line in references_raw.split("\n"):
        line = line.strip().lstrip("-•*·– ").strip()
        if line and len(line) > 3:
            references.append(line)

    # If no structured references found, try to extract article mentions
    if not references:
        art_mentions = re.findall(r"Article\s+\d+[^,\n]*", raw)
        references = list(dict.fromkeys(art_mentions))  # deduplicate preserving order

    return {
        "answer": answer,
        "references": references,
        "exact_text": exact_text,
        "explanation": explanation,
        "raw": raw,
    }


def answer(question: str, eli5: bool = False) -> dict:
    chunks = retrieve(question)
    context = build_context(chunks)
    raw = generate_explanation(question, context, eli5=eli5)
    result = parse_response(raw)
    result["chunks_used"] = [
        {
            "article": c["metadata"].get("article"),
            "title": c["metadata"].get("title") or c["metadata"].get("source_title", ""),
            "source_type": c["metadata"].get("source_type", "constitution"),
            "text": c["text"][:300] + "..." if len(c["text"]) > 300 else c["text"],
        }
        for c in chunks
    ]
    return result
