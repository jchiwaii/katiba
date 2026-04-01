"""
Parse the Kenya Constitution PDF into structured article-level chunks.

The Kenya Constitution PDF format is:
  Freedom of association.         ← article title (on its own line, before number)
  36. (1) Every person has ...    ← article number + body

Output: list of dicts with keys:
  chunk_id, article, title, chapter, part, text
"""

import re
import fitz  # PyMuPDF
from pathlib import Path


PDF_PATH = Path(__file__).parent.parent / "data" / "ken127322.pdf"


def extract_text(pdf_path: Path) -> str:
    doc = fitz.open(str(pdf_path))
    pages = []
    for page in doc:
        pages.append(page.get_text())
    doc.close()
    return "\n".join(pages)


def clean_text(text: str) -> str:
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = re.sub(r"[ \t]+", " ", text)
    # Remove page numbers (standalone digits on a line)
    text = re.sub(r"\n\s*\d+\s*\n", "\n", text)
    # Remove common header/footer noise
    text = re.sub(r"Constitution of Kenya,?\s*\d{4}\s*\n", "", text, flags=re.IGNORECASE)
    text = re.sub(r"Kenya Gazette Supplement.*?\n", "", text, flags=re.IGNORECASE)
    return text.strip()


def parse_chunks(text: str) -> list[dict]:
    lines = [l.strip() for l in text.split("\n")]
    chunks = []
    current_chapter = ""
    current_part = ""

    chapter_re = re.compile(
        r"^CHAPTER\s+(ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE|TEN|"
        r"ELEVEN|TWELVE|THIRTEEN|FOURTEEN|FIFTEEN|SIXTEEN|SEVENTEEN|EIGHTEEN)",
        re.IGNORECASE,
    )
    part_re = re.compile(r"^PART\s+(\d+|[IVXLC]+)[\s—–\-]", re.IGNORECASE)
    # Match "37. text" but NOT "37.5" (decimals) or "1980." (years at end of sentence)
    article_re = re.compile(r"^(\d{1,3})\.\s+(.+)$")
    # Title lines: end with a period, no digits at start, not too long (< 80 chars), not all caps sentence
    title_re = re.compile(r"^[A-Z][a-zA-Z\s,'\-–—]+\.\s*$")

    i = 0
    pending_title = ""  # title found on the line before an article

    while i < len(lines):
        line = lines[i]
        if not line:
            i += 1
            continue

        # Track chapter headings
        if chapter_re.match(line):
            current_chapter = line
            # Title may span next line
            if i + 1 < len(lines) and lines[i + 1] and not article_re.match(lines[i + 1]):
                current_chapter = line + " " + lines[i + 1]
            i += 1
            continue

        # Track part headings
        if part_re.match(line):
            current_part = line
            i += 1
            continue

        # Detect potential article title (short, title-cased, ends with period)
        if title_re.match(line) and len(line) < 100:
            # Check if the NEXT non-empty line starts an article
            j = i + 1
            while j < len(lines) and not lines[j]:
                j += 1
            if j < len(lines) and article_re.match(lines[j]):
                pending_title = line.rstrip(".")
                i += 1
                continue

        # Detect article start: "37. Every person..."
        m = article_re.match(line)
        if m:
            article_num = int(m.group(1))

            # Use pending title if we found one just before this article
            if pending_title:
                article_title = pending_title
                pending_title = ""
            else:
                # Fall back: use first ~60 chars of the text as title
                raw_title = m.group(2)
                article_title = raw_title[:60].rstrip(",. ") if len(raw_title) > 60 else raw_title.rstrip(".")

            # Collect body lines until next article
            body_lines = [m.group(2)]  # include the rest of the first line
            j = i + 1
            while j < len(lines):
                next_line = lines[j]
                if not next_line:
                    j += 1
                    continue

                # Stop if we see a title line followed by a new article
                if title_re.match(next_line) and len(next_line) < 100:
                    k = j + 1
                    while k < len(lines) and not lines[k]:
                        k += 1
                    if k < len(lines) and article_re.match(lines[k]):
                        break

                # Stop if next article starts
                am = article_re.match(next_line)
                if am:
                    next_art = int(am.group(1))
                    # Allow +/- 1 to handle slight numbering quirks, but not big jumps
                    if next_art > article_num:
                        break

                # Stop at chapter/part boundaries
                if chapter_re.match(next_line) or part_re.match(next_line):
                    break

                body_lines.append(next_line)
                j += 1

            body = " ".join(body_lines).strip()

            if len(body) > 20:
                chunks.append(
                    {
                        "chunk_id": f"art_{article_num}",
                        "article": article_num,
                        "title": article_title,
                        "chapter": current_chapter,
                        "part": current_part,
                        "text": body,
                    }
                )

            i = j
            continue

        i += 1

    return chunks


def parse(pdf_path: Path = PDF_PATH) -> list[dict]:
    raw = extract_text(pdf_path)
    clean = clean_text(raw)
    chunks = parse_chunks(clean)

    # Make chunk_ids unique (Schedules repeat article numbers)
    seen: dict[str, int] = {}
    for chunk in chunks:
        cid = chunk["chunk_id"]
        if cid in seen:
            seen[cid] += 1
            chunk["chunk_id"] = f"{cid}_s{seen[cid]}"
        else:
            seen[cid] = 0

    return chunks


if __name__ == "__main__":
    import json

    chunks = parse()
    print(f"Parsed {len(chunks)} article chunks\n")

    # Verify key articles
    key_articles = [37, 181, 182, 27, 43, 1]
    for c in chunks:
        if c["article"] in key_articles:
            print(f"Article {c['article']}: {c['title']}")
            print(f"  Text preview: {c['text'][:120]}...")
            print()
