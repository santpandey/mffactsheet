"""Audit: count instrument entries per section in each Excel factsheet
and compare with the extracted JSON holdingsCount."""
import json
import re
import sys
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).parent))
from extract_all_funds import (
    FUNDS, extract_month_year_from_filename, normalize_company_name,
)

SECTION_RULES = [
    ("END", [r"grand total", r"net assets"]),
    ("DERIVATIVES", [r"\bderivatives?\b", r"index\s*/\s*stock\s*futures?",
                     r"stock\s*options?", r"commodity\s*futures?", r"commodity\s*options?"]),
    ("DEBT", [r"debt\s*instruments?", r"debt\s*securities", r"bonds?\s*and\s*debentures?",
              r"non[\s-]*convertible\s*debentures?", r"corporate\s*bonds?",
              r"government\s*securities", r"government\s*bonds?", r"psu\s*bonds?"]),
    ("MONEY_MARKET", [r"money\s*market"]),
    ("FIXED_DEPOSITS", [r"fixed\s*deposits?"]),
    ("OTHERS", [r"\bothers\b", r"cash\s*[&and]+\s*cash\s*equivalents?",
                r"reverse\s*repo", r"\btreps?\b", r"tri\s*party\s*repo",
                r"net\s*current\s*assets?"]),
    ("EQUITY", [r"equity\s*[&and]+\s*equity\s*related"]),
]

SKIP_NAME_WORDS = ["total", "sub total", "subtotal"]


def classify(row_str):
    for sec, keys in SECTION_RULES:
        if any(re.search(k, row_str) for k in keys):
            return sec
    return None


def find_header(data, n_rows):
    for idx in range(n_rows):
        row_str = " ".join(str(c) for c in data[idx] if pd.notna(c)).lower()
        if ("instrument" in row_str) and (
            "% to net" in row_str or "% to nav" in row_str or
            "% of nav" in row_str or "% to aum" in row_str or
            "% of aum" in row_str
        ):
            return idx
    return None


def header_cols(header_row):
    name_col = pct_col = None
    for i, cell in enumerate(header_row):
        if pd.isna(cell):
            continue
        s = str(cell).lower().strip()
        if "name" in s and "instrument" in s and name_col is None:
            name_col = i
        if any(k in s for k in ["% to net", "% to nav", "% to aum", "% of aum", "% of nav"]):
            if pct_col is None:
                pct_col = i
    return name_col, pct_col


def audit_sheet(df):
    data = df.values
    n_rows = len(data)
    hidx = find_header(data, n_rows)
    if hidx is None:
        return None
    name_col, pct_col = header_cols(data[hidx])
    if name_col is None or pct_col is None:
        return None

    counts = {}
    samples = {}
    section = None
    for idx in range(hidx + 1, n_rows):
        row = data[idx]
        row_str = " ".join(str(c) for c in row if pd.notna(c)).lower()
        name = row[name_col] if name_col < len(row) else None
        pct = row[pct_col] if pct_col < len(row) else None

        pct_numeric = False
        if pd.notna(pct):
            try:
                float(pct)
                pct_numeric = True
            except (ValueError, TypeError):
                pass

        # Section transitions only on rows that aren't themselves entries
        if not pct_numeric:
            sec = classify(row_str)
            if sec == "END":
                break
            if sec:
                section = sec
                continue
        elif re.search(r"grand total|net assets", row_str):
            break

        if pd.isna(name) or not pct_numeric:
            continue
        name = str(name).strip()
        if len(name) < 3:
            continue
        if any(w in name.lower() for w in SKIP_NAME_WORDS):
            continue
        sec_key = section or "UNKNOWN"
        counts[sec_key] = counts.get(sec_key, 0) + 1
        samples.setdefault(sec_key, []).append((name, float(pct)))
    return counts, samples


def audit_file(filepath, sheet_match=""):
    xl = pd.ExcelFile(filepath)
    best = None
    for sheet in xl.sheet_names:
        if sheet_match:
            head = xl.parse(sheet, header=None, nrows=12)
            text = " ".join(str(c) for c in head.values.flatten() if pd.notna(c)).lower()
            if sheet_match not in text:
                continue
        df = xl.parse(sheet)
        res = audit_sheet(df)
        if res and sum(res[0].values()) >= 5:
            best = (sheet,) + res
            break
    return best


def main():
    rows = []
    for fund_key, cfg in FUNDS.items():
        excel_dir = Path(cfg["excel_folder"])
        sheet_match = cfg.get("sheet_match", "")
        for fp in sorted(excel_dir.glob("*.xlsx")):
            month, year = extract_month_year_from_filename(fp.name)
            res = audit_file(fp, sheet_match)
            json_name = f"{cfg['normalized_name']}-{month}-{year}.json"
            jpath = Path(cfg["data_folder"]) / json_name
            jdata = json.load(open(jpath)) if jpath.exists() else None
            jcount = jdata["holdingsCount"] if jdata else None
            if res:
                sheet, counts, samples = res
                total = sum(counts.values())
            else:
                sheet, counts, samples, total = None, {}, {}, 0

            # equity rows present in excel but absent from JSON
            dropped = []
            if jdata and samples.get("EQUITY"):
                jnames = {h["company"].lower() for h in jdata["holdings"]}
                for nm, pv in samples["EQUITY"]:
                    nn = normalize_company_name(nm)
                    if nn is None or nn.lower() not in jnames:
                        dropped.append((nm, pv))
            rows.append((fp.name, sheet, counts, total, jcount, samples, dropped))

    cur = None
    for name, sheet, counts, total, jcount, samples, dropped in rows:
        fund = name.split("-")[0]
        if fund != cur:
            cur = fund
            print("\n" + "#" * 78)
        diff = "" if jcount is None else f"  JSON={jcount}  MISSING={total - jcount}"
        print(f"\n{name}  [sheet={sheet}]  excel_entries={total}{diff}")
        for sec, c in counts.items():
            ex = ", ".join(n for n, _ in samples[sec][:3])
            print(f"    {sec:15s}: {c:3d}   e.g. {ex[:110]}")
        if dropped:
            print(f"    EQUITY rows dropped from JSON: "
                  + "; ".join(f"{n} ({p}%)" for n, p in dropped))


if __name__ == "__main__":
    main()
