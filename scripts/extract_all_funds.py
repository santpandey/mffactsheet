"""
Extract holdings data from Excel files for multiple mutual funds
Supports: Mirae Asset Large & Midcap Fund, Canara Robeco Large and Mid Cap Fund
"""

import json
import re
from pathlib import Path
from datetime import datetime

try:
    import pandas as pd
except ImportError:
    print("ERROR: pandas not installed. Please run: pip install pandas openpyxl")
    exit(1)

# Fund configurations
FUNDS = {
    "mirae": {
        "name": "Mirae Asset Large & Midcap Fund",
        "normalized_name": "MiraeAssetLargeAndMidcapFund",
        "excel_folder": "excel-data/mirae-asset",
        "data_folder": "data"
    },
    "canara": {
        "name": "Canara Robeco Large and Mid Cap Fund",
        "normalized_name": "CanaraRobecoLargeAndMidCapFund",
        "excel_folder": "excel-data/canara-robeco",
        "data_folder": "data"
    }
}


def normalize_company_name(name):
    """Normalize company names to handle variations like 'Limited' vs 'Ltd.'."""
    if not name or pd.isna(name):
        return None
    
    # Convert to string and strip whitespace
    name = str(name).strip()
    name = ' '.join(name.split())
    
    # Remove trailing special characters and annotations like A**, B**, etc.
    name = re.sub(r'\s+[A-Z]\*\*$', '', name)
    
    # Remove parenthetical descriptions from company names
    # e.g., "SKF India (Industrial) Ltd." -> "SKF India Ltd."
    # e.g., "Tata Motors (DVR)" -> "Tata Motors"
    name = re.sub(r'\s*\([^)]+\)\s*', ' ', name)
    
    # Standardize common suffixes
    replacements = [
        (r'\s+Limited$', ' Ltd.'),
        (r'\s+Pvt\.?\s*Ltd\.?$', ' Ltd.'),
        (r'\s+Private\s+Limited$', ' Ltd.'),
        (r'\s+Ltd$', ' Ltd.'),
        (r'\s+Ltd\.$', ' Ltd.'),
    ]
    
    for pattern, replacement in replacements:
        name = re.sub(pattern, replacement, name, flags=re.IGNORECASE)
    
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


def find_holdings_in_dataframe(df):
    """Find holdings data in a dataframe"""
    holdings = []
    
    # Find the header row
    header_row_idx = None
    for idx, row in df.iterrows():
        row_str = ' '.join([str(cell) for cell in row if pd.notna(cell)]).lower()
        # Check for header indicators
        has_instrument = 'name of the instrument' in row_str or 'instrument' in row_str
        has_percent = '% to net' in row_str or '% to nav' in row_str or '% of nav' in row_str
        
        if has_instrument and has_percent:
            header_row_idx = idx
            break
    
    if header_row_idx is None:
        print("  ERROR: Could not find header row")
        return None
    
    print(f"  Found header row at index {header_row_idx}")
    
    # Extract column indices from header row
    header_row = df.iloc[header_row_idx]
    company_col_idx = None
    percent_col_idx = None
    
    for i, cell in enumerate(header_row):
        if pd.notna(cell):
            cell_str = str(cell).lower().strip()
            if 'name of the instrument' in cell_str:
                company_col_idx = i
            elif '% to net' in cell_str or '% to nav' in cell_str:
                percent_col_idx = i
    
    if company_col_idx is None or percent_col_idx is None:
        print(f"  ERROR: Could not find columns (company={company_col_idx}, percent={percent_col_idx})")
        return None
    
    print(f"  Company column: {company_col_idx}, Percent column: {percent_col_idx}")
    
    # Detect percentage format by checking first 10 valid values
    # If all are < 1, it's decimal format (0.06274 = 6.274%)
    # If any are >= 1, it's already percentage format (6.44 = 6.44%)
    sample_values = []
    for idx in range(header_row_idx + 1, min(header_row_idx + 30, len(df))):
        row = df.iloc[idx]
        percent = row.iloc[percent_col_idx] if percent_col_idx < len(row) else None
        if pd.notna(percent):
            try:
                val = float(percent)
                if val > 0:
                    sample_values.append(val)
                    if len(sample_values) >= 10:
                        break
            except:
                pass
    
    # Determine if we need to multiply by 100
    needs_conversion = all(v < 1 for v in sample_values) if sample_values else False
    print(f"  Format detection: {'Decimal (needs *100)' if needs_conversion else 'Percentage (no conversion)'}")
    
    # Extract data starting after header row
    seen_companies = set()
    equity_section = False
    
    for idx in range(header_row_idx + 1, len(df)):
        row = df.iloc[idx]
        
        # Check if we're in equity section
        row_str = ' '.join([str(cell) for cell in row if pd.notna(cell)]).lower()
        
        if 'equity & equity related' in row_str or 'equity' in row_str:
            equity_section = True
            continue
        
        # Stop at debt or other sections
        if equity_section and any(keyword in row_str for keyword in ['debt', 'total', 'net assets', 'grand total']):
            if 'total' in row_str and len(holdings) > 0:
                break
        
        if not equity_section:
            continue
        
        # Get company name and percentage
        company = row.iloc[company_col_idx] if company_col_idx < len(row) else None
        percent = row.iloc[percent_col_idx] if percent_col_idx < len(row) else None
        
        if pd.isna(company) or pd.isna(percent):
            continue
        
        # Clean company name
        company = str(company).strip()
        if len(company) < 3:
            continue
        
        # Skip section headers and noise
        skip_words = ['equity', 'listed', 'awaiting', 'unlisted', 'total', 'fund', 
                     'benchmark', 'index', 'plan', 'regular', 'direct', 'growth', 
                     'others', 'cash', 'debt', 'portfolio', 'grand']
        if any(s in company.lower() for s in skip_words):
            continue
        
        # Parse percentage
        try:
            if isinstance(percent, str):
                percent = percent.replace('%', '').strip()
            pct_val = float(percent)
            
            # Apply conversion based on detected format
            if needs_conversion:
                pct_val = pct_val * 100
        except (ValueError, TypeError):
            continue
        
        # Validate percentage range (allow smaller percentages)
        if not (0.01 < pct_val < 50):
            continue
        
        # Normalize company name
        normalized_name = normalize_company_name(company)
        
        if not normalized_name:
            continue
        
        # Check for duplicates and merge if found
        normalized_lower = normalized_name.lower()
        if normalized_lower in seen_companies:
            # Find existing entry and add percentages
            for holding in holdings:
                if holding['company'].lower() == normalized_lower:
                    holding['percentOfNAV'] = round(holding['percentOfNAV'] + pct_val, 2)
                    break
            continue
        
        seen_companies.add(normalized_lower)
        
        holdings.append({
            "company": normalized_name,
            "percentOfNAV": round(pct_val, 2),
            "shares": None,
            "value": None
        })
        
        # Debug: Print first few holdings
        if len(holdings) <= 3:
            print(f"    DEBUG: Added {normalized_name}: {round(pct_val, 2)}%")
    
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
        
        # Try each sheet
        for sheet_name in excel_file.sheet_names:
            print(f"  Checking sheet: {sheet_name}")
            
            try:
                df = pd.read_excel(filepath, sheet_name=sheet_name)
                
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
        
        # Sort by percentage descending
        holdings.sort(key=lambda x: x["percentOfNAV"], reverse=True)
        
        # Save to JSON
        data = {
            "fundName": fund_config["name"],
            "month": month,
            "year": year,
            "extractedAt": datetime.now().isoformat(),
            "holdingsCount": len(holdings),
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
    print("=" * 70)


if __name__ == "__main__":
    main()
