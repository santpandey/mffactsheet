"""
Extract holdings data from Excel files for multiple mutual funds.
Add a new fund by appending an entry to the FUNDS dict below.
"""

import json
import re
from pathlib import Path
from datetime import datetime

try:
    import pandas as pd
except ImportError:
    print("ERROR: pandas not installed. Please run: uv sync")
    exit(1)

# Fund configurations — one entry per fund.
# Keys:
#   name            : Display name written into JSON
#   normalized_name : Used as the JSON filename prefix
#   excel_folder    : Folder containing source .xlsx files
#   data_folder     : Destination folder for JSON output
FUNDS = {
    "canara": {
        "name": "Canara Robeco Large and Mid Cap Fund",
        "normalized_name": "CanaraRobecoLargeAndMidCapFund",
        "excel_folder": "excel-data/canara-robeco",
        "data_folder": "data",
    },
    "mirae": {
        "name": "Mirae Asset Large & Midcap Fund",
        "normalized_name": "MiraeAssetLargeAndMidcapFund",
        "excel_folder": "excel-data/mirae-asset",
        "data_folder": "data",
    },
    "sbi_childrens": {
        "name": "SBI Children's Fund - Investment Plan",
        "normalized_name": "SBIChildrensFund",
        "excel_folder": "excel-data/sbi-childrens",
        "data_folder": "data",
    },
    "invesco_india_multicap": {
        "name": "Invesco India Multicap Fund",
        "normalized_name": "InvescoIndiaMulticapFund",
        "excel_folder": "excel-data/invesco-india-multicap",
        "data_folder": "data",
    },
    "canara_robeco_small_cap": {
        "name": "Canara Robeco Small Cap Fund",
        "normalized_name": "CanaraRobecoSmallCapFund",
        "excel_folder": "excel-data/canara-robeco-small-cap",
        "data_folder": "data",
    },
    "trustmf_small_cap": {
        "name": "TrustMF Small Cap Fund",
        "normalized_name": "TrustMFSmallCapFund",
        "excel_folder": "excel-data/trustmf-small-cap",
        "data_folder": "data",
        "sheet_match": "trustmf small cap fund",
    },
    "quant_small_cap": {
        "name": "Quant Small Cap Fund",
        "normalized_name": "QuantSmallCapFund",
        "excel_folder": "excel-data/quant-small-cap",
        "data_folder": "data",
    },
    "motilal_oswal_midcap": {
        "name": "Motilal Oswal Midcap Fund",
        "normalized_name": "MotilalOswalMidcapFund",
        "excel_folder": "excel-data/motilal-oswal-midcap",
        "data_folder": "data",
    },
    "hdfc_multi_asset": {
        "name": "HDFC Multi-Asset Allocation Fund",
        "normalized_name": "HDFCMultiAssetAllocationFund",
        "excel_folder": "excel-data/hdfc-multi-asset",
        "data_folder": "data",
    },
    "old_bridge_focused": {
        "name": "Old Bridge Focused Fund",
        "normalized_name": "OldBridgeFocusedFund",
        "excel_folder": "excel-data/old-bridge-focused",
        "data_folder": "data",
    },
}


MONTH_NUMBER = {
    'January': 1, 'February': 2, 'March': 3, 'April': 4, 'May': 5, 'June': 6,
    'July': 7, 'August': 8, 'September': 9, 'October': 10, 'November': 11,
    'December': 12,
}


def normalize_company_name(name, keep_parentheticals=False):
    """Normalize company names to handle variations like 'Limited' vs 'Ltd.'.

    keep_parentheticals=True preserves "(04/09/2026)" / "(Tier 2 - Basel III)"
    style annotations — for debt/money-market instruments the maturity and
    tranche details are identifying info, not noise.
    """
    if not name or pd.isna(name):
        return None

    # Convert to string and strip whitespace
    name = str(name).strip()
    name = ' '.join(name.split())

    # Remove trailing special characters and annotations like A**, B**, etc.
    name = re.sub(r'\s+[A-Z]\*\*$', '', name)

    # Remove annotation-only parentheticals (dates, DVR / partly-paid / warrant
    # markers), but keep name-bearing ones like "(Industrial)" or "(India)" —
    # post-demerger entities such as SKF India (Industrial) Ltd. vs
    # SKF India Ltd. are distinct securities and must not be merged.
    if not keep_parentheticals:
        name = re.sub(
            r'\s*\((?:[^)]*\d[^)]*|dvr|pp|partly\s*paid|warrants?)\)\s*',
            ' ',
            name,
            flags=re.IGNORECASE,
        )

    # Remove trailing footnote markers (e.g., "KEI Industries Limited ‡",
    # "HDFC Bank Ltd.£" — HDFC uses £ to flag sponsor-company holdings)
    name = re.sub(r'[\s‡±†§\*#@^~$£¥€¢]+$', '', name)

    # Standardize common suffixes
    replacements = [
        (r'\s+Limited\.?$', ' Ltd.'),
        (r'\s+Pvt\.?\s*Ltd\.?$', ' Ltd.'),
        (r'\s+Private\s+Limited$', ' Ltd.'),
        (r'\s+Ltd$', ' Ltd.'),
        (r'\s+Ltd\.$', ' Ltd.'),
    ]
    
    for pattern, replacement in replacements:
        name = re.sub(pattern, replacement, name, flags=re.IGNORECASE)
    
    # Fix stray all-caps styling in source files (e.g., "TATA Motors Ltd")
    name = re.sub(r'^TATA\b', 'Tata', name)
    
    # Remove extra spaces
    name = ' '.join(name.split())
    
    return name


def extract_month_year_from_filename(filename):
    """Extract month and year from filename"""
    filename = filename.lower()
    
    month_map = {
        'jan': 'January', 'january': 'January',
        'feb': 'February', 'february': 'February',
        'mar': 'March', 'march': 'March',
        'apr': 'April', 'april': 'April',
        'may': 'May',
        'jun': 'June', 'june': 'June',
        'jul': 'July', 'july': 'July',
        'aug': 'August', 'august': 'August',
        'sep': 'September', 'sept': 'September', 'september': 'September',
        'oct': 'October', 'october': 'October',
        'nov': 'November', 'november': 'November',
        'dec': 'December', 'december': 'December'
    }
    
    # Try to find month and year
    for abbr, full_name in month_map.items():
        if abbr in filename:
            # Extract year (4 digits)
            year_match = re.search(r'20\d{2}', filename)
            if year_match:
                return full_name, int(year_match.group())
    
    return None, None


# Section transition rules, checked on rows whose % cell is NOT numeric.
# Order matters: the first matching rule wins.
SECTION_RULES = [
    ("end", [r"grand\s*total", r"net\s*assets?", r"\bnotes?\b", r"disclosure",
             r"risk[\s-]*o[\s-]*meter", r"nav\s*(history|as\s*on)",
             r"hedging\s*positions?", r"benchmark", r"portfolio\s*turnover"]),
    ("equity", [r"equity\s*(?:&|and)\s*equity\s*related"]),
    ("derivatives", [r"\bderivatives?\b", r"\bfutures?\b", r"\boptions?\b"]),
    ("debt", [r"\bdebt\b", r"\bbonds?\b", r"debenture", r"non[\s-]*convertible",
              r"government\s*securities", r"sovereign", r"\bgilt\b",
              r"state\s*development"]),
    ("money_market", [r"money\s*market", r"treasury\s*bills?", r"t[ -]?bills?\b",
                      r"cash\s*management\s*bills?", r"commercial\s*paper",
                      r"certificate\s*of\s*deposits?"]),
    ("fixed_deposit", [r"fixed\s*deposits?", r"term\s*deposits?"]),
    ("reit_invit", [r"units\s*issued\s*by\s*(?:reit|invit)", r"\binvits?\b"]),
    ("others", [r"\bothers?\b", r"cash\s*(?:&|and)\s*cash\s*equivalents?",
                r"reverse\s*repo", r"\btreps?\b", r"tri[\s-]*party\s*repo",
                r"\brepo\b", r"net\s*current", r"receivables?", r"payables?",
                r"mutual\s*fund", r"alternative\s*investment",
                r"infrastructure\s*investment", r"\bgold\b", r"\bsilver\b",
                r"\bcommodity\b"]),
]

# Names that are section/total labels, not instruments. Matched against the
# name cell after stripping a leading "(a)"-style enumerator — so
# "Samvardhana Motherson" or "Prime Securities" are never filtered the way
# the old substring-based skip_words did.
SUBHEADER_NAMES = {
    "total", "sub total", "subtotal", "sub-total", "grand total", "net assets",
    "nil", "others", "equity shares", "listed",
    "listed / awaiting listing on stock exchanges",
    "listed/awaiting listing on stock exchanges", "unlisted",
    "equity & equity related", "debt instruments", "debt securities",
    "money market instruments", "derivatives", "fixed deposits",
    "non convertible debenture", "corporate bond", "psu & pfi bonds",
    "psu bonds", "government securities", "state development loans",
    "zero coupon bonds", "perpetual bonds", "securitised debt instruments",
    "privately placed", "commercial paper", "treasury bills",
    "cd-certificate of deposits", "certificate of deposits",
    "mutual fund unit", "mutual fund units",
    "units of infrastructure investment trust",
    "units issued by reit", "units issued by invits",
    "tri party repo (treps)", "tri party repo",
    "other receivables (payables)", "index / stock futures",
    "index / stock options", "commodity futures", "commodity option",
    "foreign securities and /or overseas etf",
    "units of an alternative investment fund (aif)", "commercial bill",
    "cash & cash equivalents", "reverse repo", "net current assets",
    "exchange traded commodity derivatives",
}

_ENUM_PREFIX = re.compile(
    r"^(?:\([a-z0-9]{1,3}\)|[a-z](?=[\s.\-)/])|\d{1,3}(?=[\s.\-)/]))[\s.\-)/]*"
)
_NOISE_NAME = re.compile(
    r"^(?:sub[\s-]*total|total|grand\s*total|net\s*assets?|nil)\b",
    re.IGNORECASE,
)


def classify_section(row_str):
    for sec, patterns in SECTION_RULES:
        if any(re.search(p, row_str) for p in patterns):
            return sec
    return None


# Sub-section header rules — applied to non-entry rows to remember which
# instrument family the following rows belong to ("Certificate Of Deposit
# (CD)", "Non-Convertible debentures / Bonds", ...). Lets issuer-only names
# like "HDFC Bank Ltd." still get the right type.
SUBTYPE_RULES = [
    ("futures", [r"futures?"]),
    ("options", [r"options?"]),
    ("government_bond", [r"government\s*securities", r"sovereign",
                         r"state\s*(?:government|development)", r"\bgilt",
                         r"central\s*government"]),
    ("securitized_debt", [r"securiti[sz]ed"]),
    ("preference_shares", [r"preference\s*shares?"]),
    ("corporate_bond", [r"non[\s-]*convertible", r"corporate\s*(?:debt|bonds?)",
                        r"\bbonds?\b", r"debentures?", r"perpetual",
                        r"at[\s-]?1\b", r"tier[\s-]*[12]\b", r"zero\s*coupon"]),
    ("certificate_of_deposit", [r"certificate\s*of\s*deposits?", r"\bcd\b"]),
    ("commercial_paper", [r"commercial\s*paper"]),
    ("treasury_bill", [r"treasury\s*bills?", r"t[ -]?bills?\b",
                       r"cash\s*management\s*bills?"]),
    ("commercial_bill", [r"commercial\s*bill", r"bills?\s*re[\s-]*discount",
                         r"\bstrips\b"]),
    ("treps", [r"treps?", r"tri[\s-]*party", r"reverse\s*repo", r"cblo",
               r"\brepo\b"]),
    ("net_receivable", [r"net\s*(?:receivable|current)", r"receivables?",
                        r"payables?", r"current\s*assets"]),
    ("margin", [r"margin"]),
    ("mutual_fund_units", [r"mutual\s*fund"]),
    ("reit_invit", [r"units\s*issued\s*by", r"invit", r"reit",
                    r"infrastructure\s*investment"]),
    ("foreign_equity", [r"foreign\s*securities", r"overseas"]),
    ("etf", [r"exchange\s*traded", r"\betf\b", r"\bgold\b", r"\bsilver\b"]),
    ("fixed_deposit", [r"(?:short|long|term|fixed)[\s-]*deposits?"]),
    ("aif", [r"alternative\s*investment"]),
]


def classify_subtype(row_str):
    for sub, patterns in SUBTYPE_RULES:
        if any(re.search(p, row_str) for p in patterns):
            return sub
    return None


def name_based_type(name):
    """Specific instrument type inferable from the entry's own name."""
    n = name.lower()
    if re.search(r"treps?|tri[\s-]*party|collateralized|\bcb[o]{1,2}\b|"
                 r"reverse\s*repo|\btrp_|\brepo\b", n):
        return "treps"
    if re.search(r"net\s*(?:receivable|current)|\bnca\b", n):
        return "net_receivable"
    if "margin" in n:
        return "margin"
    if re.search(r"exchange\s*traded|\betf\b", n):
        return "etf"
    if re.search(r"\breit\b|\binvit\b|infrastructure\s*investment", n):
        return "reit_invit"
    if re.search(r"t[ -]?bill|treasury|cash\s*management", n):
        return "treasury_bill"
    if "commercial paper" in n:
        return "commercial_paper"
    if re.search(r"certificate\s*of\s*deposit|\bcd\b", n):
        return "certificate_of_deposit"
    if re.search(r"\bgoi\b|government|sovereign|g[\s-]?sec|\bsdl\b|"
                 r"state\s*development", n):
        return "government_bond"
    if re.search(r"debenture|\bncd\b|ncrps|perpetual|at[\s-]?1\b|"
                 r"tier[\s-]*[12]|zero\s*coupon|non[\s-]*convertible", n):
        return "corporate_bond"
    if "securitisation" in n or "securitization" in n:
        return "securitized_debt"
    if "fund" in n and re.search(r"direct\s*plan|growth|idcw", n):
        return "mutual_fund_units"
    if "future" in n or re.search(r"\d{2}[/\-.]\d{2}[/\-.]\d{4}\s*$", n):
        return "futures"
    if re.search(r"option|call\b|put\b", n):
        return "options"
    return None


def find_holdings_in_dataframe(df):
    """Find holdings data in a dataframe"""
    holdings = []

    # Snapshot the frame as a plain 2-D array up front: df.iterrows()/df.iloc
    # build a Series per row and were the dominant cost of this function.
    data = df.values
    n_rows = len(data)

    def row_str_of(row):
        return ' '.join([str(cell) for cell in row if pd.notna(cell)]).lower()

    # Find the header row
    header_row_idx = None
    for idx in range(n_rows):
        row_str = row_str_of(data[idx])
        # Check for header indicators
        has_instrument = 'name of the instrument' in row_str or 'instrument' in row_str
        has_percent = '% to net' in row_str or '% to nav' in row_str or '% of nav' in row_str or '% to aum' in row_str or '% of aum' in row_str

        if has_instrument and has_percent:
            header_row_idx = idx
            break

    if header_row_idx is None:
        print("  ERROR: Could not find header row")
        return None

    print(f"  Found header row at index {header_row_idx}")

    # Extract column indices from header row
    header_row = data[header_row_idx]
    company_col_idx = None
    percent_col_idx = None

    coupon_col_idx = None
    for i, cell in enumerate(header_row):
        if pd.notna(cell):
            cell_str = str(cell).lower().strip()
            if 'name of the instrument' in cell_str or 'name of instrument' in cell_str:
                if company_col_idx is None:
                    company_col_idx = i
            elif '% to net' in cell_str or '% to nav' in cell_str or '% to aum' in cell_str or '% of aum' in cell_str:
                if percent_col_idx is None:
                    percent_col_idx = i
            elif 'coupon' in cell_str:
                coupon_col_idx = i

    if company_col_idx is None or percent_col_idx is None:
        print(f"  ERROR: Could not find columns (company={company_col_idx}, percent={percent_col_idx})")
        return None

    print(f"  Company column: {company_col_idx}, Percent column: {percent_col_idx}, Coupon column: {coupon_col_idx}")

    # Detect percentage format by checking first 10 valid values
    # If all are < 1, it's decimal format (0.06274 = 6.274%)
    # If any are >= 1, it's already percentage format (6.44 = 6.44%)
    sample_values = []
    for idx in range(header_row_idx + 1, min(header_row_idx + 30, n_rows)):
        row = data[idx]
        percent = row[percent_col_idx] if percent_col_idx < len(row) else None
        if pd.notna(percent):
            try:
                val = float(percent)
                if val > 0:
                    sample_values.append(val)
                    if len(sample_values) >= 10:
                        break
            except (ValueError, TypeError):
                pass

    # Determine if we need to multiply by 100
    needs_conversion = all(v < 1 for v in sample_values) if sample_values else False
    print(f"  Format detection: {'Decimal (needs *100)' if needs_conversion else 'Percentage (no conversion)'}")

    # Extract data starting after header row, across ALL portfolio sections
    # (equity, derivatives, debt, money market, fixed deposits, others) so the
    # JSON mirrors every numbered factsheet entry — T-bills, TREPS, futures
    # shorts, net receivables, etc.
    # seen maps (instrument_type, normalized_lower) -> holding dict so
    # duplicate merges are O(1)
    seen = {}
    section = "equity"
    subsection = None

    for idx in range(header_row_idx + 1, n_rows):
        row = data[idx]
        row_str = row_str_of(row)

        company = row[company_col_idx] if company_col_idx < len(row) else None
        percent = row[percent_col_idx] if percent_col_idx < len(row) else None

        pct_val = None
        if pd.notna(percent):
            try:
                pct_str = str(percent).replace('%', '').strip() if isinstance(percent, str) else percent
                pct_val = float(pct_str)
            except (ValueError, TypeError):
                pct_val = None

        if pct_val is None:
            # Non-entry row: a section header, a stop marker, or noise.
            sec = classify_section(row_str)
            if sec == "end":
                break
            # Inside OTHERS, sub-labels like "Margin amount for Derivative
            # positions" or "Term Deposits Placed as Margins" must not flip
            # the section back out — but "EQUITY & EQUITY RELATED" still can,
            # since some sheets (Motilal) list repo items before equity.
            if sec and (section != "others" or sec in ("equity", "reit_invit")):
                section = sec
                subsection = None
            # Track the current instrument family from sub-headers
            # ("Certificate Of Deposit (CD)", "Treasury Bills", ...)
            sub = classify_subtype(row_str)
            if sub:
                subsection = sub
            continue
        elif re.search(r"grand\s*total|net\s*assets", row_str):
            break

        if pd.isna(company):
            continue
        company = str(company).strip()
        if len(company) < 3:
            continue

        # A pure-number name is a misaligned code column, not an instrument
        try:
            float(company)
            continue
        except ValueError:
            pass

        # Count other numeric cells (quantity / market value / YTM ...) —
        # distinguishes real line items from header labels
        other_numeric = 0
        for ci, cell in enumerate(row):
            if ci in (company_col_idx, percent_col_idx) or pd.isna(cell):
                continue
            try:
                float(cell)
                other_numeric += 1
            except (ValueError, TypeError):
                pass

        # "Total"/"Sub Total"-family labels are always noise, even when they
        # carry the section's summed % value.
        if _NOISE_NAME.match(company):
            continue
        # Broader sub-header labels ("Net Current Assets", "Treasury Bills",
        # ...) are noise only when the row carries no other numbers — the same
        # words can be a genuine line item elsewhere (e.g. TrustMF).
        if other_numeric == 0:
            canonical = _ENUM_PREFIX.sub("", company.lower()).strip(" :-–—")
            if canonical in SUBHEADER_NAMES:
                continue

        # Apply conversion based on detected format
        if needs_conversion:
            pct_val = pct_val * 100

        # Sanity bound; negatives are legitimate (futures shorts, payables)
        if abs(pct_val) >= 100:
            continue

        # 0% rows count only when the row carries other numeric data
        # (quantity / market value) — e.g. residual positions like
        # "Endurance Technologies Ltd | 1086 | 31.18 | 0"
        if pct_val == 0 and other_numeric == 0:
            continue

        # Resolve the instrument type: the entry's own name wins, then the
        # current sub-header ("Certificate Of Deposit"), then the section.
        instrument_type = (
            name_based_type(company) or subsection or section
        )

        # Debt/money-market names keep identifying parentheticals such as
        # "(04/09/2026)" maturity or "(Tier 2 - Basel III)" tranche tags.
        keep_parens = instrument_type != "equity"
        normalized_name = normalize_company_name(
            company, keep_parentheticals=keep_parens)
        if not normalized_name:
            continue

        # Give issuer-only names a meaningful label: prepend the coupon when
        # the sheet provides one and the name doesn't already carry a rate —
        # "HDFC Bank Ltd." (a 9.05% NCD) reads like the equity otherwise.
        if (instrument_type != "equity" and coupon_col_idx is not None
                and not re.match(r"^\d+(?:\.\d+)?%", normalized_name)):
            coupon = (row[coupon_col_idx]
                      if coupon_col_idx < len(row) else None)
            if pd.notna(coupon):
                try:
                    normalized_name = f"{float(coupon):g}% {normalized_name}"
                except (ValueError, TypeError):
                    pass

        # Check for duplicates and merge if found (same type only)
        key = (instrument_type, normalized_name.lower())
        existing = seen.get(key)
        if existing is not None:
            existing['percentOfNAV'] = round(existing['percentOfNAV'] + pct_val, 2)
            continue

        holding = {
            "company": normalized_name,
            "instrumentType": instrument_type,
            "percentOfNAV": round(pct_val, 2),
            "shares": None,
            "value": None
        }
        seen[key] = holding
        holdings.append(holding)

        # Debug: Print first few holdings
        if len(holdings) <= 3:
            print(f"    DEBUG: Added {normalized_name} [{instrument_type}]: {round(pct_val, 2)}%")

    return holdings if len(holdings) >= 5 else None


def process_excel_file(filepath, fund_config):
    """Process a single Excel file and extract holdings"""
    print(f"\nProcessing: {filepath.name}")
    
    month, year = extract_month_year_from_filename(filepath.name)
    if not month or not year:
        print(f"  ERROR: Could not extract month/year from filename")
        return False
    
    print(f"  Detected: {month} {year}")
    
    try:
        # Try to read all sheets
        excel_file = pd.ExcelFile(filepath)
        print(f"  Sheets: {excel_file.sheet_names}")
        
        holdings = None
        sheet_match = fund_config.get("sheet_match", "").lower()
        
        # Try each sheet — all reads go through the open ExcelFile handle so
        # the workbook zip is only opened once (pd.read_excel(filepath, ...)
        # re-opens and re-parses the file on every call).
        for sheet_name in excel_file.sheet_names:
            print(f"  Checking sheet: {sheet_name}")

            try:
                if sheet_match:
                    # Cheap 12-row pre-filter before paying for a full parse
                    head = excel_file.parse(sheet_name, header=None, nrows=12)
                    head_text = ' '.join(
                        str(c) for c in head.values.flatten() if pd.notna(c)
                    ).lower()
                    if sheet_match not in head_text:
                        continue
                    print(f"  [MATCH] Sheet '{sheet_name}' matches '{sheet_match}'")

                df = excel_file.parse(sheet_name)

                if df.empty:
                    continue

                sheet_holdings = find_holdings_in_dataframe(df)

                if sheet_holdings and len(sheet_holdings) >= 5:
                    holdings = sheet_holdings
                    print(f"  [OK] Found {len(holdings)} holdings in sheet '{sheet_name}'")
                    break
            except Exception as e:
                print(f"  Error reading sheet '{sheet_name}': {e}")
                continue
        
        if not holdings:
            print(f"  ERROR: No holdings found in any sheet")
            return False
        
        # Corporate-action disambiguation: effective Oct 1, 2025 the listed
        # Tata Motors Ltd was renamed Tata Motors Passenger Vehicles Ltd, and
        # the demerged CV entity (TML Commercial Vehicles) was renamed
        # "Tata Motors Ltd". Factsheets therefore report an ambiguous
        # "Tata Motors Ltd." for the CV business — tag it for clarity.
        if (year, MONTH_NUMBER[month]) >= (2025, 10):
            for h in holdings:
                if (h["company"] == "Tata Motors Ltd."
                        and h.get("instrumentType") == "equity"):
                    h["company"] = "Tata Motors Ltd. (Commercial Vehicles)"

        # Sort by percentage descending
        holdings.sort(key=lambda x: x["percentOfNAV"], reverse=True)

        section_counts = {}
        for h in holdings:
            t = h.get("instrumentType", "equity")
            section_counts[t] = section_counts.get(t, 0) + 1

        # Save to JSON
        data = {
            "fundName": fund_config["name"],
            "month": month,
            "year": year,
            "extractedAt": datetime.now().isoformat(),
            "holdingsCount": len(holdings),
            "sectionCounts": section_counts,
            "holdings": holdings
        }
        
        filename = f"{fund_config['normalized_name']}-{month}-{year}.json"
        output_path = Path(fund_config['data_folder']) / filename
        
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        
        print(f"  [OK] Saved {len(holdings)} holdings to {filename}")
        print(f"  Top 5 holdings:")
        for h in holdings[:5]:
            print(f"    - {h['company']}: {h['percentOfNAV']}%")
        
        return True
        
    except Exception as e:
        print(f"  ERROR: {e}")
        import traceback
        traceback.print_exc()
        return False


def process_fund(fund_key):
    """Process all Excel files for a specific fund"""
    fund_config = FUNDS[fund_key]
    
    print("=" * 70)
    print(f"{fund_config['name']} - Excel Extractor")
    print("=" * 70)
    
    excel_dir = Path(fund_config['excel_folder'])
    data_dir = Path(fund_config['data_folder'])
    data_dir.mkdir(exist_ok=True)
    
    excel_files = sorted(excel_dir.glob("*.xlsx"))
    
    if not excel_files:
        print(f"\nNo Excel files found in {excel_dir}")
        return 0
    
    print(f"\nFound {len(excel_files)} Excel files")
    
    success = 0
    for filepath in excel_files:
        if process_excel_file(filepath, fund_config):
            success += 1
    
    print("\n" + "=" * 70)
    print(f"Completed: {success}/{len(excel_files)} files processed successfully")
    print(f"Data saved to: {data_dir}")
    print("=" * 70)
    
    return success


def main():
    print("\n" + "=" * 70)
    print("MULTI-FUND EXTRACTION SCRIPT")
    print("=" * 70)
    
    total_success = 0
    total_files = 0
    
    for fund_key in FUNDS.keys():
        success = process_fund(fund_key)
        total_success += success
        
        # Count total files
        excel_dir = Path(FUNDS[fund_key]['excel_folder'])
        total_files += len(list(excel_dir.glob("*.xlsx")))
        
        print("\n")
    
    print("=" * 70)
    print(f"OVERALL: {total_success}/{total_files} files processed successfully")

    # Keep frontend data discovery in sync after extraction
    try:
        from generate_manifest import generate_manifest

        generate_manifest()
    except Exception as e:
        print(f"WARNING: Could not generate manifest.json: {e}")

    print("=" * 70)


if __name__ == "__main__":
    main()
