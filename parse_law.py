"""
Cambodian Labour Law Parser — v2  (raw_text_data_labor_law.txt)
===============================================================
This file contains ALL 4 laws in a SINGLE PASS with FULL BODY TEXT.

Verified structure:
  # LAW: <name>           (case-insensitive, e.g. "# Law:" for Social Security)
  ## CHAPTER: <name>      [optional PAGE: annotation]
  ### SECTION: <name>     [optional PAGE: annotation]
  * SUB SECTION: <name>   [PAGE: ...] or [START PAGE: ...]
  ARTICLE: មាត្រា N      [PAGE: ...]
  <body text lines ...>
  (repeat)

Laws and article counts (verified):
  ច្បាប់ស្តីពីការងារ         396 articles
  ច្បាប់ស្តីពីសហជីព          100 articles
  ច្បាប់ស្តីពីរបបសន្តិសុខសង្គម 105 articles
  ច្បាប់ស្តីពីប្រាក់ឈ្នួលអប្បបរមា 30  articles
  TOTAL: 631 articles

Key difference from previous file:
  - NO separate TOC block.  Every article has its body text right below it.
  - Trade Union and Social Security BOTH have full text (not TOC-only).
  - SUB SECTION markers appear as structural headers (with their own PAGE refs),
    then immediately followed by ARTICLE lines.
"""

import re, json, unicodedata
from dataclasses import dataclass, asdict
from typing import List, Optional, Dict, Tuple
from pathlib import Path
from collections import Counter


# ─── Khmer numeral converter ─────────────────────────────────────────────────
KH = {"០":0,"១":1,"២":2,"៣":3,"៤":4,"៥":5,"៦":6,"៧":7,"៨":8,"៩":9}

def kh2int(s: str) -> Optional[int]:
    """Convert Khmer numeral string to int. Returns None on failure."""
    # Strip invisible unicode chars (zero-width space, non-breaking space etc.)
    s = "".join(c for c in s if unicodedata.category(c) not in ("Cf", "Zs") or c == " ")
    s = s.strip()
    result = "".join(str(KH[c]) if c in KH else c if c.isdigit() else "X" for c in s)
    return int(result) if result.isdigit() else None

def norm_num(raw: str) -> Tuple[str, bool]:
    """
    ('៧៤ (ថ្មី)')  →  ('74', True)
    ('74')        →  ('74', False)
    """
    amended = "(ថ្មី)" in raw or "ថ្មី" in raw
    num = re.sub(r'\(ថ្មី\)', '', raw).strip()
    # Remove trailing dash or space after Khmer letter sub-section prefix
    arabic = "".join(str(KH[c]) if c in KH else c if c.isdigit() else "" for c in num)
    return (arabic.strip() or num.strip(), amended)


# ─── Data model ──────────────────────────────────────────────────────────────
@dataclass
class LegalChunk:
    chunk_id: str           # "labor_law__art_74"
    law_name: str           # "ច្បាប់ស្តីពីការងារ"
    law_name_en: str        # "Labor Law"
    article_number: str     # "74"
    article_number_int: int # 74
    article_title: str      # derived from SECTION heading (no explicit titles in this file)
    chapter: str
    chapter_number: str     # "4"
    section: str
    sub_section: str
    text: str               # body paragraph text
    embed_text: str         # enriched for embedding (title + hierarchy + body)
    page_number: int        # PDF page (Arabic integer)
    pdf_filename: str
    language: str = "km"
    is_amended: bool = False


# ─── Law metadata ─────────────────────────────────────────────────────────────
META: Dict[str, Dict] = {
    "ច្បាប់ស្តីពីការងារ":           {"en": "Labor Law",          "pdf": "labor_law.pdf",           "slug": "labor_law"},
    "ច្បាប់ស្ទីពីសហជីព":           {"en": "Trade Union Law",     "pdf": "trade_union_law.pdf",     "slug": "trade_union_law"},
    "ច្បាប់ស្តីពីសហជីព":           {"en": "Trade Union Law",     "pdf": "trade_union_law.pdf",     "slug": "trade_union_law"},
    "ច្បាប់ស្ទីពីរបបសន្និសុខសង្គម":  {"en": "Social Security Law","pdf": "social_security_law.pdf","slug": "social_security_law"},
    "ច្បាប់ស្តីពីរបបសន្តិសុខសង្គម":  {"en": "Social Security Law","pdf": "social_security_law.pdf","slug": "social_security_law"},
    "ច្បាប់ស្តីពីប្រាក់ឈ្នួលអប្បបរមា": {"en": "Minimum Wage Law", "pdf": "minimum_wage_law.pdf",   "slug": "minimum_wage_law"},
}

def get_meta(law: str) -> Dict:
    if law in META: return META[law]
    for k, v in META.items():
        if k in law or law in k: return v
    slug = re.sub(r"\W+", "_", law)[:25]
    return {"en": law, "pdf": f"{slug}.pdf", "slug": slug}

def extract_chapter_num(chapter_text: str) -> str:
    """Extract arabic chapter number from 'ជំពូកទី ៤: ...' → '4'"""
    m = re.search(r'ជំពូកទី\s*([\d០-៩]+)', chapter_text)
    if m:
        num = "".join(str(KH[c]) if c in KH else c if c.isdigit() else "" for c in m.group(1))
        return num
    return ""


# ─── Regex patterns ───────────────────────────────────────────────────────────
R_LAW     = re.compile(r"^#\s*LAW:\s*(.+)$", re.IGNORECASE)
R_CHAP    = re.compile(r"^##\s*CHAPTER:\s*(.+?)(?:\s*\[.*\])?$")
R_SECT    = re.compile(r"^###\s*SECTION:\s*(.+?)(?:\s*\[.*\])?$")
R_SUB     = re.compile(r"^\*\s*SUB\s*SECTION:\s*(.+?)(?:\s*\[.*\])?$")
R_ART     = re.compile(
    r"^ARTICLE:\s*មាត្រា\s*([\d០-៩]+(?:\s*\(ថ្មី\))?)\s*"
    r"(?:\[(?:START\s*)?PAGE[:\s]*([^\]]+)\])?$"
)
# Page refs can have invisible unicode chars; be lenient
R_PAGE_IN_MARKER = re.compile(r'\[(?:START\s*)?PAGE[:\s]*([^\]]+)\]')

def extract_page(line: str) -> Optional[int]:
    """Extract page number from any line containing [PAGE: ...] or [START PAGE: ...]."""
    m = R_PAGE_IN_MARKER.search(line)
    if m:
        return kh2int(m.group(1))
    return None

def is_structural(s: str) -> bool:
    return bool(R_LAW.match(s) or R_CHAP.match(s) or R_SECT.match(s) or
                R_SUB.match(s) or R_ART.match(s))

def build_embed(art_num, law_name, chapter, section, sub_section, body) -> str:
    header = f"{law_name} — មាត្រា {art_num}"
    parts = [header]
    if chapter:    parts.append(chapter)
    if section:    parts.append(section)
    if sub_section: parts.append(sub_section)
    if body:       parts.append(body)
    return "\n\n".join(parts)


# ─── Main parser ──────────────────────────────────────────────────────────────
def parse(filepath: str) -> List[LegalChunk]:
    lines = Path(filepath).read_text(encoding="utf-8").splitlines()
    chunks: List[LegalChunk] = []

    # State machine
    law = chap = sect = sub = ""
    chap_num = ""
    art_num = ""; art_page = 0; art_amended = False
    body_lines: List[str] = []

    def flush():
        nonlocal art_num, art_page, art_amended, body_lines
        if not art_num or not law:
            art_num = ""; body_lines = []; return

        text = "\n".join(l for l in body_lines if l.strip())
        if not text:
            art_num = ""; body_lines = []; return

        m = get_meta(law)
        try: art_int = int(art_num)
        except: art_int = 0

        # Article title = first line of body IF it looks like a short title,
        # else fall back to empty (section name is in embed_text anyway)
        title = ""
        body_stripped = text.strip()
        first_line = body_stripped.split("\n")[0].strip()
        # Use first line as title only if it's short (≤ 60 chars) and ends 
        # without a period (i.e. looks like a heading, not a sentence)
        if first_line and len(first_line) <= 60 and not first_line.endswith("។"):
            title = first_line

        chunk = LegalChunk(
            chunk_id          = f"{m['slug']}__art_{art_num}",
            law_name          = law,
            law_name_en       = m["en"],
            article_number    = art_num,
            article_number_int= art_int,
            article_title     = title,
            chapter           = chap,
            chapter_number    = chap_num,
            section           = sect,
            sub_section       = sub,
            text              = text,
            embed_text        = build_embed(art_num, law, chap, sect, sub, text),
            page_number       = art_page,
            pdf_filename      = m["pdf"],
            is_amended        = art_amended,
        )
        chunks.append(chunk)
        art_num = ""; art_page = 0; art_amended = False; body_lines = []

    for raw in lines:
        s = raw.strip()

        # ── Law boundary ──
        m = R_LAW.match(s)
        if m:
            flush()
            law = m.group(1).strip()
            chap = sect = sub = chap_num = ""
            continue

        if not law:
            continue

        # ── Chapter ──
        m = R_CHAP.match(s)
        if m:
            flush()
            chap = m.group(1).strip()
            chap_num = extract_chapter_num(chap)
            sect = sub = ""
            continue

        # ── Section ──
        m = R_SECT.match(s)
        if m:
            flush()
            sect = m.group(1).strip()
            sub = ""
            continue

        # ── Sub-section ──
        m = R_SUB.match(s)
        if m:
            flush()
            sub = m.group(1).strip()
            continue

        # ── Article header ──
        m = R_ART.match(s)
        if m:
            flush()
            raw_num = m.group(1).strip()
            art_num, art_amended = norm_num(raw_num)
            art_page = kh2int((m.group(2) or "").strip()) or 0
            continue

        # ── Body text ──
        if art_num and s and not is_structural(s):
            # Filter out lines that are purely decorative (horizontal rules etc.)
            if not re.match(r'^[_\-=*]{3,}$', s):
                body_lines.append(s)

    flush()
    return chunks


# ─── Post-processing ─────────────────────────────────────────────────────────

def deduplicate(chunks: List[LegalChunk]) -> List[LegalChunk]:
    """Keep one chunk per chunk_id; prefer longer text."""
    seen: Dict[str, LegalChunk] = {}
    for c in chunks:
        ex = seen.get(c.chunk_id)
        if ex is None or len(c.text) > len(ex.text):
            seen[c.chunk_id] = c
    return sorted(seen.values(),
                  key=lambda c: (c.law_name_en, c.article_number_int, c.article_number))


# ─── Output ───────────────────────────────────────────────────────────────────

def save_json(chunks: List[LegalChunk], path: str):
    Path(path).write_text(
        json.dumps([asdict(c) for c in chunks], ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(f"✔  {len(chunks)} chunks  →  {path}")

def save_jsonl(chunks: List[LegalChunk], path: str):
    Path(path).write_text(
        "\n".join(json.dumps(asdict(c), ensure_ascii=False) for c in chunks),
        encoding="utf-8",
    )
    print(f"✔  {len(chunks)} chunks  →  {path}  (JSONL)")

def validate(chunks: List[LegalChunk]):
    """Run quality checks and print a report."""
    law_counts    = Counter(c.law_name_en for c in chunks)
    with_page     = sum(1 for c in chunks if c.page_number > 0)
    with_title    = sum(1 for c in chunks if c.article_title)
    amended       = sum(1 for c in chunks if c.is_amended)
    empty_body    = [c for c in chunks if not c.text.strip()]
    dup_ids       = [cid for cid, n in Counter(c.chunk_id for c in chunks).items() if n > 1]

    print("\n╔═══════════════════════════════════════════════╗")
    print("║         PARSE & VALIDATION REPORT            ║")
    print("╚═══════════════════════════════════════════════╝")
    print(f"  Total chunks        : {len(chunks)}")
    for law, n in sorted(law_counts.items()):
        exp = {"Labor Law":396,"Trade Union Law":100,"Social Security Law":105,"Minimum Wage Law":30}.get(law, "?")
        status = "✔" if n == exp else f"⚠ (expected {exp})"
        print(f"  {law:<37} {n:>4}  {status}")

    print(f"\n  With page number    : {with_page}/{len(chunks)}")
    print(f"  With article title  : {with_title}/{len(chunks)}")
    print(f"  Amended articles    : {amended}")

    if empty_body:
        print(f"\n  ⚠  Chunks with empty body: {len(empty_body)}")
        for c in empty_body[:3]:
            print(f"     → {c.chunk_id}")
    else:
        print(f"\n  ✔  No empty-body chunks")

    if dup_ids:
        print(f"  ⚠  Duplicate chunk_ids: {dup_ids[:5]}")
    else:
        print(f"  ✔  No duplicate chunk_ids")

    print("\n─── 3 sample chunks ──────────────────────────────")
    samples = [c for c in chunks if c.page_number > 0][::max(1, len(chunks)//3)][:3]
    for c in samples:
        print(f"\n  [{c.chunk_id}]")
        print(f"  law         : {c.law_name_en}")
        print(f"  page        : {c.page_number}  |  chapter: {c.chapter_number}  |  amended: {c.is_amended}")
        print(f"  title       : {c.article_title or '(none)'}")
        print(f"  chapter     : {c.chapter[:65]}")
        print(f"  section     : {c.section[:65]}")
        print(f"  sub_section : {c.sub_section[:65]}")
        print(f"  text (150)  : {c.text[:150]}…")

    print("\n─── embed_text sample (Art 73 — fixed-term contract) ─")
    art73 = next((c for c in chunks if c.chunk_id == "labor_law__art_73"), None)
    if art73:
        print(art73.embed_text[:500])


# ─── Entry point ─────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import sys
    src  = sys.argv[1] if len(sys.argv) > 1 else "raw_text_data_labor_law.txt"
    dest = sys.argv[2] if len(sys.argv) > 2 else "law_chunks_v2.json"

    print(f"Parsing: {src}")
    raw_chunks = parse(src)
    chunks     = deduplicate(raw_chunks)
    validate(chunks)
    save_json(chunks, dest)
    save_jsonl(chunks, dest.replace(".json", ".jsonl"))
