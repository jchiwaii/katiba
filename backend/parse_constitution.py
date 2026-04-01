"""
Parse the Kenya Constitution PDF into structured article-level chunks.

The Kenya Constitution PDF format puts the article title BEFORE the article number:

  Freedom of association.         ← title heading
  36. (1) Every person has ...    ← article number + body

Output: list of dicts with keys:
  chunk_id, article, title, chapter, part, text, is_schedule
"""

import re
import fitz  # PyMuPDF
from pathlib import Path


PDF_PATH = Path(__file__).parent.parent / "data" / "ken127322.pdf"

# Manual title overrides for articles whose heading is missing in the PDF
TITLE_OVERRIDES: dict[int, str] = {
    166: "Appointment of judges",
    170: "Kadhis' courts",
    183: "Functions of county executive committee",
    186: "Distribution of functions between governments",
    196: "Business of county assemblies",
    222: "Authorization of expenditure before Appropriation Act",
    240: "National Security Council",
    249: "Objects and authority of commissions and independent offices",
}


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
    text = re.sub(r"\n\s*\d+\s*\n", "\n", text)
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
    article_re = re.compile(r"^(\d{1,3})\.\s+(.+)$")
    title_re = re.compile(r"^[A-Z][a-zA-Z\s,'\-–—]+\.\s*$")

    i = 0
    pending_title = ""

    while i < len(lines):
        line = lines[i]
        if not line:
            i += 1
            continue

        # Track chapter headings
        if chapter_re.match(line):
            current_chapter = line
            if i + 1 < len(lines) and lines[i + 1] and not article_re.match(lines[i + 1]):
                current_chapter = line + " " + lines[i + 1]
            i += 1
            continue

        # Track part headings
        if part_re.match(line):
            current_part = line
            i += 1
            continue

        # Detect article title heading (short line ending with period, before an article number)
        if title_re.match(line) and len(line) < 100:
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

            # Apply title: manual override > pending title > first ~60 chars of text
            if article_num in TITLE_OVERRIDES:
                article_title = TITLE_OVERRIDES[article_num]
                pending_title = ""
            elif pending_title:
                article_title = pending_title
                pending_title = ""
            else:
                raw = m.group(2)
                article_title = raw[:60].rstrip(",. ") if len(raw) > 60 else raw.rstrip(".")

            # Collect body lines until next article
            body_lines = [m.group(2)]
            j = i + 1
            while j < len(lines):
                next_line = lines[j]
                if not next_line:
                    j += 1
                    continue

                # Stop if title line precedes a new article
                if title_re.match(next_line) and len(next_line) < 100:
                    k = j + 1
                    while k < len(lines) and not lines[k]:
                        k += 1
                    if k < len(lines) and article_re.match(lines[k]):
                        break

                am = article_re.match(next_line)
                if am and int(am.group(1)) > article_num:
                    break

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
                        "is_schedule": False,  # set in parse() after deduplication
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

    # Deduplicate chunk IDs — the first occurrence is the main constitution article,
    # subsequent occurrences (from Schedules/Transitional sections) get _s1, _s2 suffix
    # and are tagged as is_schedule=True.
    seen: dict[str, int] = {}
    for chunk in chunks:
        cid = chunk["chunk_id"]
        if cid in seen:
            seen[cid] += 1
            chunk["chunk_id"] = f"{cid}_s{seen[cid]}"
            chunk["is_schedule"] = True
        else:
            seen[cid] = 0

    return chunks


if __name__ == "__main__":
    import json

    chunks = parse()
    main = [c for c in chunks if not c["is_schedule"]]
    sched = [c for c in chunks if c["is_schedule"]]
    print(f"Total: {len(chunks)} | Main: {len(main)} | Schedule/duplicates: {len(sched)}")
    print()

    # Verify fixed titles
    print("Fixed titles:")
    for art_num in sorted(TITLE_OVERRIDES.keys()):
        matches = [c for c in main if c["article"] == art_num]
        if matches:
            print(f"  Art {art_num}: {matches[0]['title']}")
    print()

    # Verify key articles
    print("Key articles:")
    for art_num in [1, 27, 37, 43, 49, 181, 182]:
        matches = [c for c in main if c["article"] == art_num]
        if matches:
            c = matches[0]
            print(f"  Art {art_num}: \"{c['title']}\" — {c['text'][:80]}...")
