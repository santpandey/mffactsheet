import json
import re
from pathlib import Path

def generate_manifest():
    """Scans the data directory for fund JSON files and generates a manifest.json.
    This prevents the frontend from guessing filenames and generating 404 errors."""
    
    script_dir = Path(__file__).parent
    data_dir = script_dir.parent / "data"
    manifest_path = data_dir / "manifest.json"
    
    manifest = {}
    
    # Matches filenames like CanaraRobecoLargeAndMidCapFund-April-2025.json
    pattern = re.compile(r'^([a-zA-Z0-9]+)-([a-zA-Z]+)-(\d{4})\.json$')
    
    for file_path in data_dir.glob("*.json"):
        if file_path.name == "manifest.json":
            continue
            
        match = pattern.match(file_path.name)
        if match:
            fund_key, month, year = match.groups()
            year = int(year)
            
            if fund_key not in manifest:
                manifest[fund_key] = []
                
            manifest[fund_key].append({
                "month": month,
                "year": year,
                "filename": file_path.name
            })
            
    with open(manifest_path, 'w', encoding='utf-8') as f:
        json.dump(manifest, f, indent=2)
        
    print(f"Manifest generated at {manifest_path} with {sum(len(v) for v in manifest.values())} files across {len(manifest)} funds.")

if __name__ == "__main__":
    generate_manifest()
