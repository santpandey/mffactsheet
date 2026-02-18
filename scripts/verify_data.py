"""
Verify extracted data quality
"""
import json
from pathlib import Path

data_dir = Path(__file__).parent.parent / "data"
json_files = sorted(data_dir.glob("MiraeAssetLargeAndMidcapFund-*.json"))

print("=" * 70)
print("Data Verification Report")
print("=" * 70)

for filepath in json_files:
    with open(filepath, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    month = data['month']
    year = data['year']
    count = data['holdingsCount']
    
    print(f"\n{month} {year}:")
    print(f"  Total Holdings: {count}")
    print(f"  Top 5:")
    for i, h in enumerate(data['holdings'][:5], 1):
        print(f"    {i}. {h['company']}: {h['percentOfNAV']}%")
    
    # Check data quality
    total_nav = sum(h['percentOfNAV'] for h in data['holdings'])
    print(f"  Total NAV %: {total_nav:.2f}%")

print("\n" + "=" * 70)
print(f"Total files: {len(json_files)}")
print("=" * 70)
