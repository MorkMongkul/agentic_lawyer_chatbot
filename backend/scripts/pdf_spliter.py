"""
Split law_of_working.pdf into 4 separate law PDFs.
Run from anywhere:
    python split_pdf.py
"""
from pypdf import PdfWriter, PdfReader
from pathlib import Path

SOURCE = Path("/Users/macbookair/Documents/agentics_rag_lawyer_chatbot/backend/data/raw/law_of_working.pdf")
OUT_DIR = Path("/Users/macbookair/Documents/agentics_rag_lawyer_chatbot/backend/data/raw")

# (output_filename, first_page, last_page)  ← 1-based page numbers, inclusive
LAWS = [
    ("labor_law.pdf",           21,  116),
    ("trade_union_law.pdf",    117,  152),
    ("social_security_law.pdf",153,  193),
    ("minimum_wage_law.pdf",   194,  204),
]

def split():
    if not SOURCE.exists():
        print(f"ERROR: source PDF not found at {SOURCE}")
        return

    reader = PdfReader(str(SOURCE))
    total  = len(reader.pages)
    print(f"Source : {SOURCE.name}  ({total} pages)\n")

    for filename, start, end in LAWS:
        # Validate range
        if start < 1 or end > total or start > end:
            print(f"  SKIP  {filename}  — invalid range {start}-{end} (PDF has {total} pages)")
            continue

        writer = PdfWriter()
        # pypdf uses 0-based index
        for page_num in range(start - 1, end):
            writer.add_page(reader.pages[page_num])

        out_path = OUT_DIR / filename
        with open(out_path, "wb") as f:
            writer.write(f)

        size_kb = out_path.stat().st_size / 1024
        print(f"  ✔  {filename:<30} pages {start:>3}–{end:<3}  ({end - start + 1} pages)  {size_kb:.0f} KB")

    print("\nDone — all PDFs saved to:", OUT_DIR)

if __name__ == "__main__":
    split()