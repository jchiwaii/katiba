"""
One-time ingestion script.

1. Parse PDF into article chunks
2. Filter to main constitution only (exclude Schedule/transitional duplicates)
3. Build enriched embedding text (title + chapter + body) for better semantic search
4. Embed with sentence-transformers
5. Store in ChromaDB
6. Save chunks.json for debugging
"""

import json
from pathlib import Path

import chromadb
from chromadb.config import Settings
from sentence_transformers import SentenceTransformer

from parse_constitution import parse

CHROMA_DIR = Path(__file__).parent.parent / "data" / "chroma"
CHUNKS_FILE = Path(__file__).parent.parent / "data" / "chunks.json"
COLLECTION_NAME = "constitution"
EMBEDDING_MODEL = "multi-qa-MiniLM-L6-cos-v1"


def make_embedding_text(chunk: dict) -> str:
    """
    Build a rich text string for embedding.

    The model sees: title (repeated for weight) + chapter + body text.
    Repeating the title improves recall for title-based queries.
    Including chapter helps disambiguate (e.g., "rights" in Bill of Rights vs Finance).
    """
    parts = [
        f"Article {chunk['article']}: {chunk['title']}.",
        f"{chunk['title']}.",  # repeat title for semantic weight
    ]
    if chunk.get("chapter"):
        parts.append(chunk["chapter"])
    if chunk.get("part"):
        parts.append(chunk["part"])
    parts.append(chunk["text"])
    return " ".join(parts)


def ingest():
    print("Step 1: Parsing PDF...")
    all_chunks = parse()
    # Only embed main constitution articles — filter out Schedule/transitional duplicates
    chunks = [c for c in all_chunks if not c["is_schedule"]]
    print(f"  → {len(all_chunks)} total chunks, using {len(chunks)} main constitution articles")

    # Save full set for inspection
    CHUNKS_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(CHUNKS_FILE, "w", encoding="utf-8") as f:
        json.dump(all_chunks, f, indent=2, ensure_ascii=False)
    print(f"  → Saved to {CHUNKS_FILE}")

    print("\nStep 2: Loading embedding model...")
    model = SentenceTransformer(EMBEDDING_MODEL)
    print(f"  → Loaded {EMBEDDING_MODEL}")

    print("\nStep 3: Embedding chunks (enriched text)...")
    texts = [make_embedding_text(c) for c in chunks]
    embeddings = model.encode(texts, show_progress_bar=True, batch_size=32)
    print(f"  → {len(embeddings)} embeddings created")

    print("\nStep 4: Storing in ChromaDB...")
    CHROMA_DIR.mkdir(parents=True, exist_ok=True)
    client = chromadb.PersistentClient(
        path=str(CHROMA_DIR),
        settings=Settings(anonymized_telemetry=False),
    )

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
        documents=[c["text"] for c in chunks],  # store raw text (not enriched) for display
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
