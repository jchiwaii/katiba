"""
One-time ingestion script.

1. Parse the PDF into article chunks
2. Embed each chunk with sentence-transformers
3. Store in ChromaDB (persisted to disk)
4. Save chunks.json for inspection
"""

import json
import os
from pathlib import Path

import chromadb
from chromadb.config import Settings
from sentence_transformers import SentenceTransformer

from parse_constitution import parse

CHROMA_DIR = Path(__file__).parent.parent / "data" / "chroma"
CHUNKS_FILE = Path(__file__).parent.parent / "data" / "chunks.json"
COLLECTION_NAME = "constitution"
EMBEDDING_MODEL = "all-MiniLM-L6-v2"


def ingest():
    print("Step 1: Parsing PDF...")
    chunks = parse()
    print(f"  → {len(chunks)} article chunks parsed")

    # Save chunks for inspection/debugging
    CHUNKS_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(CHUNKS_FILE, "w", encoding="utf-8") as f:
        json.dump(chunks, f, indent=2, ensure_ascii=False)
    print(f"  → Saved to {CHUNKS_FILE}")

    print("\nStep 2: Loading embedding model...")
    model = SentenceTransformer(EMBEDDING_MODEL)
    print(f"  → Loaded {EMBEDDING_MODEL}")

    print("\nStep 3: Embedding chunks...")
    texts = [f"Article {c['article']} - {c['title']}: {c['text']}" for c in chunks]
    embeddings = model.encode(texts, show_progress_bar=True, batch_size=32)
    print(f"  → {len(embeddings)} embeddings created")

    print("\nStep 4: Storing in ChromaDB...")
    CHROMA_DIR.mkdir(parents=True, exist_ok=True)
    client = chromadb.PersistentClient(
        path=str(CHROMA_DIR),
        settings=Settings(anonymized_telemetry=False),
    )

    # Delete existing collection if re-ingesting
    try:
        client.delete_collection(COLLECTION_NAME)
        print("  → Deleted existing collection")
    except Exception:
        pass

    collection = client.create_collection(
        name=COLLECTION_NAME,
        metadata={"hnsw:space": "cosine"},
    )

    collection.add(
        ids=[c["chunk_id"] for c in chunks],
        embeddings=embeddings.tolist(),
        documents=[c["text"] for c in chunks],
        metadatas=[
            {
                "article": c["article"],
                "title": c["title"],
                "chapter": c["chapter"],
                "part": c["part"],
            }
            for c in chunks
        ],
    )
    print(f"  → Stored {collection.count()} chunks in ChromaDB at {CHROMA_DIR}")
    print("\nIngestion complete.")


if __name__ == "__main__":
    ingest()
