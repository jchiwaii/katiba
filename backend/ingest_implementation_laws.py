"""
Ingest Kenyan constitutional implementation laws into a separate Chroma collection.

These are ordinary Acts of Parliament made under, or closely tied to, the 2010
Constitution. They are intentionally stored separately from the Constitution so
retrieval can cite them as implementation detail, not as constitutional text.
"""

from __future__ import annotations

import argparse
import json
import re
import time
from html import unescape
from pathlib import Path
from typing import Iterable

import chromadb
import requests
from chromadb.config import Settings
from sentence_transformers import SentenceTransformer

CHROMA_DIR = Path(__file__).parent.parent / "data" / "chroma"
BASE_DIR = Path(__file__).parent.parent / "data" / "implementation_laws"
SOURCES_FILE = BASE_DIR / "sources.json"
CHUNKS_FILE = BASE_DIR / "chunks.json"
RAW_DIR = BASE_DIR / "raw"
COLLECTION_NAME = "implementation_laws"
EMBEDDING_MODEL = "multi-qa-MiniLM-L6-cos-v1"

REQUEST_HEADERS = {
    "User-Agent": "KatibaRAG/1.0 (+https://new.kenyalaw.org)",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}

END_MARKERS = [
    "History of this document",
    "Documents citing this one",
    "Legislation cited by this one",
    "Subsidiary legislation",
    "Report Report a problem",
]


def load_sources(limit: int | None = None) -> list[dict]:
    with open(SOURCES_FILE, encoding="utf-8") as f:
        sources = json.load(f)
    return sources[:limit] if limit else sources


def safe_filename(source_id: str) -> str:
    return re.sub(r"[^a-zA-Z0-9_.-]+", "-", source_id).strip("-")


def download_html(source: dict, refresh: bool = False) -> str:
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    path = RAW_DIR / f"{safe_filename(source['id'])}.html"
    if path.exists() and not refresh:
        return path.read_text(encoding="utf-8")

    response = requests.get(
        source["source_url"],
        headers=REQUEST_HEADERS,
        timeout=60,
        allow_redirects=True,
    )
    response.raise_for_status()
    path.write_text(response.text, encoding="utf-8")
    return response.text


def html_to_text(html: str) -> str:
    text = re.sub(r"(?is)<(script|style|svg|noscript|header|footer|nav).*?</\1>", " ", html)
    text = re.sub(r"(?i)<br\s*/?>", "\n", text)
    text = re.sub(r"(?i)</(p|div|section|article|h[1-6]|li|tr|td|th)>", "\n", text)
    text = re.sub(r"(?s)<[^>]+>", " ", text)
    text = unescape(text)
    text = text.replace("\u00a0", " ")
    lines = [re.sub(r"\s+", " ", line).strip() for line in text.splitlines()]
    return "\n".join(line for line in lines if line)


def crop_law_text(text: str, source: dict) -> str:
    lower = text.lower()
    start_candidates = [
        lower.find("laws of kenya"),
        lower.find(source["title"].lower()),
    ]
    starts = [idx for idx in start_candidates if idx >= 0]
    start = min(starts) if starts else 0

    end_positions = []
    for marker in END_MARKERS:
        idx = lower.find(marker.lower(), start + 2000)
        if idx >= 0:
            end_positions.append(idx)
    end = min(end_positions) if end_positions else len(text)

    cropped = text[start:end].strip()
    return normalize_text(cropped)


def normalize_text(text: str) -> str:
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def split_long_text(text: str, max_chars: int = 3600, overlap: int = 350) -> Iterable[str]:
    if len(text) <= max_chars:
        yield text
        return

    start = 0
    while start < len(text):
        end = min(start + max_chars, len(text))
        if end < len(text):
            boundary = text.rfind("\n", start, end)
            if boundary > start + 1200:
                end = boundary
        piece = text[start:end].strip()
        if piece:
            yield piece
        if end >= len(text):
            break
        start = max(end - overlap, 0)


def section_chunks(source: dict, text: str) -> list[dict]:
    section_re = re.compile(
        r"(?m)^(?P<number>\d+[A-Z]?)\.\s+(?P<title>[^\n]{3,180})$"
    )
    matches = list(section_re.finditer(text))

    chunks: list[dict] = []
    if len(matches) < 2:
        for index, piece in enumerate(split_long_text(text)):
            chunks.append(make_chunk(source, index, piece, "General text"))
        return chunks

    preamble = text[: matches[0].start()].strip()
    if preamble:
        chunks.append(make_chunk(source, len(chunks), preamble, "Preamble and document details"))

    for index, match in enumerate(matches):
        next_start = matches[index + 1].start() if index + 1 < len(matches) else len(text)
        section_text = text[match.start():next_start].strip()
        section_title = f"{match.group('number')}. {match.group('title').strip()}"
        for piece in split_long_text(section_text):
            chunks.append(make_chunk(source, len(chunks), piece, section_title))

    return chunks


def make_chunk(source: dict, index: int, text: str, section_title: str) -> dict:
    articles = ", ".join(source.get("constitution_articles", []))
    return {
        "chunk_id": f"law-{source['id']}-{index:04d}",
        "text": normalize_text(text),
        "source_id": source["id"],
        "source_title": source["title"],
        "citation": source["citation"],
        "source_url": source["source_url"],
        "source_type": source.get("source_type", "implementation_law"),
        "status": source.get("status", "current_law"),
        "category": source.get("category", ""),
        "constitution_articles": articles,
        "section_title": section_title,
        "notes": source.get("notes", ""),
    }


def make_embedding_text(chunk: dict) -> str:
    parts = [
        f"{chunk['source_title']} {chunk['citation']}.",
        f"Implementation law for Constitution Article(s): {chunk['constitution_articles']}.",
        chunk.get("category", ""),
        chunk.get("section_title", ""),
        chunk["text"],
    ]
    return " ".join(part for part in parts if part)


def collect_chunks(sources: list[dict], refresh: bool = False) -> tuple[list[dict], list[dict]]:
    chunks: list[dict] = []
    failures: list[dict] = []

    for source in sources:
        print(f"Fetching {source['title']} ({source['citation']})...")
        try:
            html = download_html(source, refresh=refresh)
            text = crop_law_text(html_to_text(html), source)
            source_chunks = section_chunks(source, text)
            chunks.extend(c for c in source_chunks if c["text"])
            print(f"  -> {len(source_chunks)} chunks")
            time.sleep(0.15)
        except Exception as exc:
            failures.append({"id": source["id"], "title": source["title"], "error": str(exc)})
            print(f"  !! failed: {exc}")

    return chunks, failures


def ingest(limit: int | None = None, refresh: bool = False, download_only: bool = False) -> None:
    sources = load_sources(limit=limit)
    print(f"Loaded {len(sources)} implementation law sources")

    chunks, failures = collect_chunks(sources, refresh=refresh)
    BASE_DIR.mkdir(parents=True, exist_ok=True)
    with open(CHUNKS_FILE, "w", encoding="utf-8") as f:
        json.dump(chunks, f, indent=2, ensure_ascii=False)
    print(f"\nSaved {len(chunks)} chunks to {CHUNKS_FILE}")

    if failures:
        failures_file = BASE_DIR / "failures.json"
        with open(failures_file, "w", encoding="utf-8") as f:
            json.dump(failures, f, indent=2, ensure_ascii=False)
        print(f"Saved {len(failures)} download failures to {failures_file}")
    else:
        failures_file = BASE_DIR / "failures.json"
        if failures_file.exists():
            failures_file.unlink()

    if download_only:
        print("Download-only mode complete.")
        return

    if not chunks:
        raise RuntimeError("No implementation-law chunks were created.")

    print("\nLoading embedding model...")
    model = SentenceTransformer(EMBEDDING_MODEL)

    print("Embedding implementation-law chunks...")
    texts = [make_embedding_text(chunk) for chunk in chunks]
    embeddings = model.encode(texts, show_progress_bar=True, batch_size=32)

    print("Storing implementation-law collection in ChromaDB...")
    CHROMA_DIR.mkdir(parents=True, exist_ok=True)
    client = chromadb.PersistentClient(
        path=str(CHROMA_DIR),
        settings=Settings(anonymized_telemetry=False),
    )

    try:
        client.delete_collection(COLLECTION_NAME)
        print("  -> Deleted existing implementation-law collection")
    except Exception:
        pass

    collection = client.create_collection(
        name=COLLECTION_NAME,
        metadata={"hnsw:space": "cosine"},
    )
    collection.add(
        ids=[chunk["chunk_id"] for chunk in chunks],
        embeddings=embeddings.tolist(),
        documents=[chunk["text"] for chunk in chunks],
        metadatas=[
            {
                "source_id": chunk["source_id"],
                "source_title": chunk["source_title"],
                "title": chunk["source_title"],
                "citation": chunk["citation"],
                "source_url": chunk["source_url"],
                "source_type": chunk["source_type"],
                "status": chunk["status"],
                "category": chunk["category"],
                "constitution_articles": chunk["constitution_articles"],
                "section_title": chunk["section_title"],
            }
            for chunk in chunks
        ],
    )
    print(f"Stored {collection.count()} implementation-law chunks in {CHROMA_DIR}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Ingest Kenyan implementation laws.")
    parser.add_argument("--limit", type=int, default=None, help="Only process the first N sources.")
    parser.add_argument("--refresh", action="store_true", help="Re-download cached Kenya Law HTML pages.")
    parser.add_argument("--download-only", action="store_true", help="Download and chunk without embedding.")
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    ingest(limit=args.limit, refresh=args.refresh, download_only=args.download_only)
