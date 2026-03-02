"""
HDFC Factsheet PDF Extractor
=============================
Extracts holdings for 'HDFC Large and Mid Cap Fund' from the combined
HDFC monthly factsheet PDF.

Strategy:
- The PDF is a multi-fund factsheet; each fund spans 2 pages.
- The portfolio is a 2-column layout (left col x~200-370, right col x~385-550).
- Left sidebar (x < 195) contains fund metadata — ignored.
- We use word-level bounding-box extraction and group words by y-coordinate
  to reconstruct each row, then parse Company | Industry | % to NAV.

Usage:
    python scripts/extract_hdfc_pdf.py <pdf_path> [month] [year]
    e.g. python scripts/extract_hdfc_pdf.py "HDFC MF Factsheet - January 2026_0.pdf" January 2026
"""

import json
import re
import sys
from datetime import datetime
from pathlib import Path

import pdfplumber

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
ROOT_DIR = Path(__file__).parent.parent
DATA_DIR = ROOT_DIR / "data"
EXCEL_DIR = ROOT_DIR / "excel-data" / "hdfc"

FUND_HEADING = "hdfc large and mid cap fund"
FUND_NAME_DISPLAY = "HDFC Large and Mid Cap Fund"
FUND_KEY = "HDFCLargeAndMidCapFund"  # Must match UI fund key

# X-coordinate boundaries (in PDF points, page width ~595)
PORTFOLIO_X_MIN = 195.0   # ignore left sidebar (NAV, dates, etc.)
COL_SPLIT_X    = 383.0   # left col: 195-383, right col: 383-595
PAGE_X_MAX     = 595.0

# Y-coordinate: portfolio section starts after "EQUITY & EQUITY RELATED"
# We detect this dynamically per page.

# Row grouping tolerance (words within this many pts vertically = same row)
Y_TOLERANCE = 3.5

# A % NAV value looks like a float: 0.45, 1.23, 12.34 etc.
PCT_PATTERN = re.compile(r'^\d{1,2}\.\d{1,2}$')

# Markers that signal end of equity holdings
END_MARKERS = {
    "debt & debt related",
    "money market instruments",
    "cash, cash equivalents",
    "grand total",
    "sub total",
    "net current assets",
    "total",
    "mutual fund units",  # FOF section
    "fof",
    "fund of funds",
    "portfolio instrument",
    "category of scheme",
}

# Markers that signal start of equity section
EQUITY_START = "equity & equity related"

# Words to skip (section headers, footnotes, etc.)
SKIP_WORDS = {
    "equity", "&", "equity", "related", "listed", "unlisted",
    "top", "ten", "holdings", "•",
}


# ---------------------------------------------------------------------------
# Core extraction
# ---------------------------------------------------------------------------

def _is_pct(text: str) -> bool:
    """Return True if text looks like a % NAV value (e.g. 4.83, 0.45)."""
    return bool(PCT_PATTERN.match(text.strip()))


def _words_from_strip(page, x0: float, x1: float) -> list:
    """
    Crop the page to a vertical strip [x0, x1] and extract words.
    Returns list of word dicts sorted by (top, x0).
    """
    cropped = page.within_bbox((x0, 0, x1, page.height))
    words = cropped.extract_words(
        keep_blank_chars=False,
        x_tolerance=3,
        y_tolerance=3,
    )
    return sorted(words, key=lambda w: (w["top"], w["x0"]))


def _group_into_rows(words: list, y_tol: float = Y_TOLERANCE) -> list:
    """
    Group words by vertical position.
    Returns list of rows; each row = list of word dicts sorted by x0.
    """
    if not words:
        return []
    rows, cur, cur_top = [], [words[0]], words[0]["top"]
    for w in words[1:]:
        if abs(w["top"] - cur_top) <= y_tol:
            cur.append(w)
        else:
            rows.append(sorted(cur, key=lambda x: x["x0"]))
            cur, cur_top = [w], w["top"]
    rows.append(sorted(cur, key=lambda x: x["x0"]))
    return rows


def _find_equity_start_y(words: list) -> float:
    """
    Find the y-coordinate where equity holdings start.
    Looks for 'EQUITY & EQUITY RELATED' header OR 'Company Industry+' header row.
    Returns the top value, or 0.0 if not found.
    """
    for i, w in enumerate(words):
        txt_upper = w["text"].upper()
        # Check for "EQUITY & EQUITY RELATED"
        if txt_upper == "EQUITY":
            ctx = " ".join(words[j]["text"] for j in range(i, min(i + 5, len(words)))).upper()
            if "EQUITY RELATED" in ctx:
                return w["top"]
        # Check for "Company" header (right column doesn't have EQUITY header)
        if txt_upper == "COMPANY":
            ctx = " ".join(words[j]["text"] for j in range(i, min(i + 3, len(words)))).upper()
            if "INDUSTRY" in ctx:
                return w["top"]
    return 0.0


def _find_end_y(words: list, start_y: float) -> float:
    """
    Find the y-coordinate where equity holdings end (debt section / grand total).
    Returns page height (i.e. no limit) if not found.
    """
    end_triggers = {"debt", "grand", "money", "net", "cash,"}
    for w in words:
        if w["top"] <= start_y:
            continue
        if w["text"].lower() in end_triggers:
            return w["top"]
    return 99999.0


def _parse_strip_rows(rows: list, strip_x0: float, is_left_col: bool) -> list:
    """
    Parse holdings from rows of a single column strip.

    PDF layout insight (from calibration):
      - Each holding spans 2 y-lines within the same column:
        Line 1 (y=N):   Company name words (leftmost in the strip)
        Line 2 (y=N+3): Industry words (middle) + % NAV (rightmost)
      - The % NAV is always on the SECOND line, rightmost position.

    Strategy:
      - Accumulate words until we see a row with a % NAV float at the end.
      - When we see the % NAV, flush the accumulated company name + current
        row's industry words as one holding.
    """
    holdings = []
    pending_company = []  # words from previous row(s) that are company name

    # Skip-list: section headers, footnote markers, bullet points, column headers
    SKIP_EXACT = {"•", "ò", "£", "¥", "€", "$", "#", "*", "^", "ú", "Company", "Industry+", "Industry", "%", "to", "NAV"}

    # X-coordinate thresholds (relative to strip start) based on calibration:
    # Left column (strip starts at 195):  Company < 70, Industry >= 87, % >= 164
    # Right column (strip starts at 383): Company < 70, Industry >= 77, % >= 155
    if is_left_col:
        COMPANY_X_MAX = 70.0
        INDUSTRY_X_MIN = 85.0
        PCT_X_MIN = 155.0  # Lowered from 160 to capture % at rel_x ~159
    else:
        COMPANY_X_MAX = 70.0
        INDUSTRY_X_MIN = 75.0
        PCT_X_MIN = 150.0

    def clean_text(txt, is_company=False):
        """Remove footnote markers and clean up text."""
        txt = re.sub(r'[£¥€$#*^ú]+', '', txt).strip()
        if is_company:
            # For company names, strip leading bullets/hyphens
            txt = re.sub(r'^[•ò\s]+', '', txt).strip()
        # Normalize multiple spaces
        txt = re.sub(r'\s+', ' ', txt).strip()
        return txt

    for row in rows:
        if not row:
            continue

        row_text = " ".join(w["text"] for w in row).strip()
        row_lower = row_text.lower()

        # Stop at debt/end section markers
        if any(m in row_lower for m in END_MARKERS):
            break

        # Skip section headers
        if "equity" in row_lower and "related" in row_lower:
            continue
        if row_lower in ("listed", "unlisted", "equity", "related"):
            continue
        if "top ten" in row_lower:
            continue

        # Filter out pure-symbol words
        clean_row = [w for w in row if w["text"] not in SKIP_EXACT]
        if not clean_row:
            continue

        # Calculate relative x-coordinates
        for w in clean_row:
            w["rel_x"] = w["x0"] - strip_x0

        # Find % NAV: rightmost word that matches float pattern AND is at x >= PCT_X_MIN
        pct_val = None
        pct_idx = None
        for idx in range(len(clean_row) - 1, -1, -1):
            w = clean_row[idx]
            if _is_pct(w["text"]) and w["rel_x"] >= PCT_X_MIN:
                pct_val = w["text"]
                pct_idx = idx
                break

        if pct_val is not None:
            # This row has the % NAV — it's the "completion" row
            # Words before pct on THIS row are industry words
            # pending_company has the company name from previous row(s)

            industry_words = [w for w in clean_row[:pct_idx] if w["rel_x"] >= INDUSTRY_X_MIN]
            # Also check if there are company words on this row (rel_x < COMPANY_X_MAX)
            company_words_this_row = [w for w in clean_row[:pct_idx] if w["rel_x"] < COMPANY_X_MAX]

            all_company_words = pending_company + company_words_this_row
            
            company = " ".join(clean_text(w["text"], is_company=True) for w in all_company_words).strip()
            industry = " ".join(clean_text(w["text"], is_company=False) for w in industry_words).strip()

            # Final cleanup
            company = clean_text(company, is_company=True)
            industry = clean_text(industry, is_company=False)

            if company:
                try:
                    holdings.append({
                        "company": company,
                        "industry": industry,
                        "percentOfNAV": float(pct_val),
                    })
                except ValueError:
                    pass

            pending_company = []
        else:
            # No % NAV on this row — it's a company name row
            # Accumulate words with rel_x < COMPANY_X_MAX as company name
            company_words = [w for w in clean_row if w["rel_x"] < COMPANY_X_MAX]
            if company_words:
                pending_company.extend(company_words)

    return holdings


def _is_continuation_page(page_text: str) -> bool:
    """Check if this is a continuation page (has '....Contd from previous page')."""
    return "contd from previous" in page_text.lower() or "contd from prev" in page_text.lower()


def _extract_from_initial_page(page, all_holdings: list):
    """
    Extract holdings from the initial fund page (page 18 style).
    Layout: 2 columns, each with Company | Industry | % NAV
    Left col: x 195-383, Right col: x 383-560
    """
    LEFT_X0, LEFT_X1 = 195.0, 383.0
    RIGHT_X0, RIGHT_X1 = 383.0, 560.0

    for strip_x0, strip_x1, is_left in [(LEFT_X0, LEFT_X1, True), (RIGHT_X0, RIGHT_X1, False)]:
        strip_words = _words_from_strip(page, strip_x0, strip_x1)
        eq_y = _find_equity_start_y(strip_words)
        section_words = [w for w in strip_words if w["top"] >= eq_y - 2]
        rows = _group_into_rows(section_words)
        strip_holdings = _parse_strip_rows(rows, strip_x0, is_left)
        all_holdings.extend(strip_holdings)


def _extract_from_continuation_page(page, all_holdings: list):
    """
    Extract holdings from continuation pages (page 19+ style).
    Layout: 2 columns with different x-coordinates
    Left col: x 195-300 (Company fragments + Industry fragments + % NAV at ~271)
    Right col: x 300-560 (Company at ~303, Industry at ~422, % NAV at ~526)
    
    Both columns have holdings that need to be extracted.
    """
    # LEFT column on continuation pages: Company at ~200, Industry at ~196-270, % at ~271
    LEFT_X0, LEFT_X1 = 195.0, 300.0
    left_words = _words_from_strip(page, LEFT_X0, LEFT_X1)
    eq_y_left = _find_equity_start_y(left_words)
    if eq_y_left == 0:
        eq_y_left = 100  # Default start if no header found
    section_words_left = [w for w in left_words if w["top"] >= eq_y_left - 2]
    rows_left = _group_into_rows(section_words_left)
    left_holdings = _parse_continuation_left_rows(rows_left, LEFT_X0)
    all_holdings.extend(left_holdings)
    
    # RIGHT column on continuation pages: Company at x=303, Industry at x=422, % at x=526
    RIGHT_X0, RIGHT_X1 = 300.0, 560.0
    strip_words = _words_from_strip(page, RIGHT_X0, RIGHT_X1)
    eq_y = _find_equity_start_y(strip_words)
    section_words = [w for w in strip_words if w["top"] >= eq_y - 2]
    rows = _group_into_rows(section_words)
    strip_holdings = _parse_continuation_rows(rows, RIGHT_X0)
    all_holdings.extend(strip_holdings)


def _parse_continuation_left_rows(rows: list, strip_x0: float) -> list:
    """
    Parse holdings from continuation page LEFT column.
    The left column has fragmented data - skip for now.
    """
    return []


def _extract_special_holdings(page, all_holdings: list):
    """
    Extract REIT/InvIT and Mutual Fund holdings from special sections.
    These appear on page 20 in the right column with format:
      - Embassy Office Parks REIT Realty 0.36
      - HDFC BSE SENSEX ETF 0.14
    """
    # Right column where special holdings appear
    RIGHT_X0, RIGHT_X1 = 300.0, 560.0
    cropped = page.within_bbox((RIGHT_X0, 150, RIGHT_X1, 250))
    words = cropped.extract_words()
    
    if not words:
        return
    
    # Group by y
    rows = {}
    for w in words:
        y_key = round(w["top"] / 3) * 3
        if y_key not in rows:
            rows[y_key] = []
        rows[y_key].append(w)
    
    # Look for REIT and ETF holdings
    for y_key in sorted(rows.keys()):
        row_words = sorted(rows[y_key], key=lambda w: w["x0"])
        row_text = " ".join(w["text"] for w in row_words)
        row_lower = row_text.lower()
        
        # Skip headers and totals
        if "sub total" in row_lower or "total" in row_lower:
            continue
        if "units issued" in row_lower or "mutual fund" in row_lower:
            continue
        if "cash" in row_lower or "grand total" in row_lower:
            continue
        
        # Look for REIT or ETF holdings with % NAV
        if ("reit" in row_lower or "etf" in row_lower) and re.search(r'\d+\.\d{2}', row_text):
            # Extract company, industry, and % NAV
            pct_match = re.search(r'(\d+\.\d{2})$', row_text.strip())
            if pct_match:
                pct_val = float(pct_match.group(1))
                pre_text = row_text[:pct_match.start()].strip()
                
                # Split into company and industry (industry is usually last word before %)
                parts = pre_text.rsplit(' ', 1)
                if len(parts) == 2:
                    company = parts[0].strip()
                    industry = parts[1].strip()
                else:
                    company = pre_text
                    industry = "REIT" if "reit" in row_lower else "ETF"
                
                if company and pct_val > 0:
                    all_holdings.append({
                        "company": company,
                        "industry": industry,
                        "percentOfNAV": pct_val,
                    })


def _parse_continuation_rows(rows: list, strip_x0: float) -> list:
    """
    Parse holdings from continuation page RIGHT column.
    Different x-thresholds: Company at rel_x 0-120, Industry at 120-220, % at 220+
    """
    holdings = []
    pending_company = []
    
    SKIP_EXACT = {"•", "ò", "£", "¥", "€", "$", "#", "*", "^", "ú", "Company", "Industry+", "Industry", "%", "to", "NAV"}
    
    # Continuation page thresholds (relative to strip_x0=300)
    COMPANY_X_MAX = 120.0
    INDUSTRY_X_MIN = 120.0
    PCT_X_MIN = 220.0

    def clean_text(txt, is_company=False):
        txt = re.sub(r'[£¥€$#*^ú]+', '', txt).strip()
        if is_company:
            txt = re.sub(r'^[•ò\s]+', '', txt).strip()
        txt = re.sub(r'\s+', ' ', txt).strip()
        return txt

    for row in rows:
        if not row:
            continue

        row_text = " ".join(w["text"] for w in row).strip()
        row_lower = row_text.lower()

        if any(m in row_lower for m in END_MARKERS):
            break
        if "equity" in row_lower and "related" in row_lower:
            continue
        if row_lower in ("listed", "unlisted", "equity", "related"):
            continue
        if "top ten" in row_lower:
            continue

        clean_row = [w for w in row if w["text"] not in SKIP_EXACT]
        if not clean_row:
            continue

        for w in clean_row:
            w["rel_x"] = w["x0"] - strip_x0

        pct_val = None
        pct_idx = None
        for idx in range(len(clean_row) - 1, -1, -1):
            w = clean_row[idx]
            if _is_pct(w["text"]) and w["rel_x"] >= PCT_X_MIN:
                pct_val = w["text"]
                pct_idx = idx
                break

        if pct_val is not None:
            industry_words = [w for w in clean_row[:pct_idx] if w["rel_x"] >= INDUSTRY_X_MIN]
            company_words_this_row = [w for w in clean_row[:pct_idx] if w["rel_x"] < COMPANY_X_MAX]
            all_company_words = pending_company + company_words_this_row
            
            company = " ".join(clean_text(w["text"], is_company=True) for w in all_company_words).strip()
            industry = " ".join(clean_text(w["text"], is_company=False) for w in industry_words).strip()
            company = clean_text(company, is_company=True)
            industry = clean_text(industry, is_company=False)

            if company:
                try:
                    holdings.append({
                        "company": company,
                        "industry": industry,
                        "percentOfNAV": float(pct_val),
                    })
                except ValueError:
                    pass
            pending_company = []
        else:
            company_words = [w for w in clean_row if w["rel_x"] < COMPANY_X_MAX]
            if company_words:
                pending_company.extend(company_words)

    return holdings


def extract_fund_holdings(pdf_path: Path) -> list:
    """
    Extract HDFC Large and Mid Cap Fund holdings from the PDF.

    Handles two page layouts:
    1. Initial page (page 18): 2-column layout with Company|Industry|% in each
    2. Continuation pages (page 19+): Different column structure

    Returns list of {company, industry, percentOfNAV} dicts.
    """
    all_holdings = []

    with pdfplumber.open(str(pdf_path)) as pdf:
        # Step 1: find pages containing the fund heading (skip TOC page 0)
        # Also filter out pages that belong to other funds (FOF, Flexi Cap, etc.)
        OTHER_FUNDS = [
            "fund of funds", "fof", "flexi cap", "balanced advantage",
            "multi-asset", "asset allocator", "hybrid", "arbitrage"
        ]
        
        fund_pages = []
        for i, page in enumerate(pdf.pages):
            if i == 0:
                continue
            text = page.extract_text() or ""
            text_lower = text.lower()
            
            if FUND_HEADING in text_lower and "portfolio" in text_lower:
                # Check if this page belongs to a different fund
                is_other_fund = any(other in text_lower for other in OTHER_FUNDS)
                if not is_other_fund:
                    fund_pages.append(i)

        if not fund_pages:
            raise ValueError(f"Could not find '{FUND_HEADING}' in PDF")

        print(f"  Found fund on pages: {[p+1 for p in fund_pages]}")

        for page_idx in fund_pages:
            page = pdf.pages[page_idx]
            page_text = page.extract_text() or ""
            
            # Check if this is a continuation page
            if _is_continuation_page(page_text):
                _extract_from_continuation_page(page, all_holdings)
                # Also extract REIT/InvIT and Mutual Fund holdings from special sections
                if "reit" in page_text.lower() or "etf" in page_text.lower():
                    _extract_special_holdings(page, all_holdings)
            else:
                _extract_from_initial_page(page, all_holdings)

    # Deduplicate (same company can appear across page continuation)
    seen, unique = set(), []
    for h in all_holdings:
        key = h["company"].lower().strip()
        if key and key not in seen:
            seen.add(key)
            unique.append(h)

    return unique


def save_to_json(holdings: list, month: str, year: int, out_dir: Path) -> Path:
    """Save extracted holdings to JSON in the standard format."""
    out_dir.mkdir(parents=True, exist_ok=True)
    filename = f"{FUND_KEY}-{month}-{year}.json"
    out_path = out_dir / filename

    data = {
        "fundName": FUND_NAME_DISPLAY,
        "month": month,
        "year": year,
        "extractedAt": datetime.now().isoformat(),
        "holdingsCount": len(holdings),
        "holdings": holdings,
    }

    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

    return out_path


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python scripts/extract_hdfc_pdf.py <pdf_path> [Month] [Year]")
        sys.exit(1)

    pdf_path = Path(sys.argv[1])
    if not pdf_path.exists():
        print(f"ERROR: PDF not found: {pdf_path}")
        sys.exit(1)

    # Parse month/year from args or from filename
    if len(sys.argv) >= 4:
        month = sys.argv[2]
        year  = int(sys.argv[3])
    else:
        # Try to parse from filename e.g. "HDFC MF Factsheet - January 2026_0.pdf"
        m = re.search(r'(\w+)\s+(\d{4})', pdf_path.name)
        if m:
            month = m.group(1)
            year  = int(m.group(2))
        else:
            month = "Unknown"
            year  = datetime.now().year

    print(f"Extracting: {FUND_NAME_DISPLAY} | {month} {year}")
    print(f"PDF: {pdf_path}")

    holdings = extract_fund_holdings(pdf_path)

    print(f"\nExtracted {len(holdings)} holdings:")
    for h in holdings:
        print(f"  {h['company']:<50} {h['industry']:<30} {h['percentOfNAV']:.2f}%")

    if holdings:
        out_path = save_to_json(holdings, month, year, DATA_DIR)
        print(f"\nSaved -> {out_path}")
    else:
        print("\nWARNING: No holdings extracted. Check PDF structure.")
        sys.exit(1)
