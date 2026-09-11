"""
Fetch top 10 up movers from NIFTY 50 stocks.
This script processes quote data and calculates daily/weekly changes.
Data is fetched via Kite MCP tools (already authenticated).
"""

import json
from datetime import datetime
from pathlib import Path

# NIFTY Midcap 100 stock symbols (NSE)
NIFTY_MIDCAP_100_STOCKS = [
    "ABB", "ADANIPORTS", "AIAENG", "AJANTPHARM", "ALKEM", "AMARAJABAT", "AMBUJACEM",
    "APARINDS", "APLLTD", "APOLLOHOSP", "ARVIND", "ASTRAL", "AUBANK", "AUROPHARMA",
    "AVANTIFEED", "BAJAJ-AUTO", "BAJAJFINSV", "BAJFINANCE", "BALKRISIND", "BANDHANBNK",
    "BANKBARODA", "BATAIND", "BEL", "BEML", "BHARATFORG", "BHARTIARTL", "BHEL",
    "BIOCON", "BLUESTARCO", "BOSCHLTD", "BPCL", "BRITANNIA", "CANFINHOME", "CASTROLIND",
    "CENTURYTEX", "CHAMBLFERT", "CHOLAFIN", "CIPLA", "COALINDIA", "COFORGE", "COLPAL",
    "CONCOR", "CROMPTON", "CUB", "CUMMINSIND", "DABUR", "DALMIASBAJ", "DEEPAKNTR",
    "DIXON", "DLF", "DMART", "DRREDDY", "EICHERMOT", "EMAMILTD", "ENDURANCE",
    "ESCORTS", "EXIDEIND", "FEDERALBNK", "FSL", "GAIL", "GLENMARK", "GODREJCP",
    "GODREJIND", "GODREJPROP", "GRANULES", "GRASIM", "GUJGASLTD", "HAVELLS", "HCLTECH",
    "HDFCBANK", "HDFCLIFE", "HEROMOTOCO", "HINDALCO", "HINDPETRO", "HINDUNILVR",
    "HINDZINC", "HONASA", "ICICIBANK", "IDFCFIRSTB", "IEX", "IGL", "INDIGO",
    "INDIANB", "INDUSINDBK", "INFY", "IOC", "ITC", "JINDALSAW", "JINDALSTEL",
    "JUBLFOOD", "JYOTHYLAB", "KAJARIACER", "KALPATKORP", "KOTAKBANK", "KSCL", "LALPATHLAB",
    "LICHSGFIN", "LT", "LTIM", "LUPIN", "M&M", "M&MFIN", "MADRASFERT",
    "MAHLIFE", "MARICO", "MARUTI", "MAXHEALTH", "MCDOWELL-N", "MFSL", "MGL",
    "MINDTREE", "MOTHERSON", "MPHASIS", "MRF", "MUTHOOTFIN", "NAUKRI", "NAVINFLUOR",
    "NESTLEIND", "NMDC", "NTPC", "OFSS", "OLECTRA", "ONGC", "PAGEIND",
    "PEL", "PETRONET", "PFIZER", "PERSISTENT", "PIDILITIND", "PIIND", "PNB",
    "POLYCAB", "POLYMED", "POONAWALLA", "POWERGRID", "PRSMJOHNSN", "PVRINOX",
    "RAMCOCEM", "RALLIS", "RATANPOWER", "RBLBANK", "RECLTD", "RELIGARE", "RELIANCE",
    "RITES", "RVNL", "SAIL", "SANOFI", "SBILIFE", "SBIN", "SCHAEFFLER",
    "SHARDACEN", "SHREECEM", "SIEMENS", "SRF", "STAR", "SUNPHARMA", "SUNTV",
    "SYNGENE", "TANLA", "TATACONSUM", "TATACOMM", "TATAMOTORS", "TATAPOWER", "TATASTEEL",
    "TCS", "TECHM", "TITAN", "TORNTPHARM", "TORNTPOWER", "TRENT", "TV18BRDCST",
    "TVSMOTOR", "UBL", "ULTRACEMCO", "UNIONBANK", "UPL", "VBL", "VEDL",
    "VGUARD", "VOLTAS", "WELCORP", "WELSPUNLIVE", "WIPRO", "ZENSARTECH", "ZFCVIND",
    "ZOMATO"
]

# Output directory
OUTPUT_DIR = Path("data")
OUTPUT_DIR.mkdir(exist_ok=True)


def calculate_daily_change(quote):
    """Calculate daily % change from previous close"""
    if not quote or not quote.get("ohlc") or not quote.get("ohlc").get("close"):
        return None
    prev_close = quote["ohlc"]["close"]
    last_price = quote.get("last_price")
    if not last_price or prev_close == 0:
        return None
    return round(((last_price - prev_close) / prev_close) * 100, 2)


def process_quotes(quotes_data):
    """Process quote data and calculate daily changes"""
    results = []
    
    for instrument_id, quote in quotes_data.items():
        if not quote:
            continue
        
        # Extract symbol from instrument_id (e.g., "NSE:RELIANCE" -> "RELIANCE")
        symbol = instrument_id.split(":")[-1] if ":" in instrument_id else instrument_id
        
        daily_change = calculate_daily_change(quote)
        
        if daily_change is not None:
            results.append({
                "symbol": symbol,
                "instrument_id": instrument_id,
                "last_price": quote.get("last_price"),
                "prev_close": quote.get("ohlc", {}).get("close"),
                "daily_change_pct": daily_change,
                "volume": quote.get("volume"),
                "timestamp": quote.get("timestamp")
            })
    
    return results


def get_top_up_movers(results, top_n=10):
    """Get top N up movers sorted by daily change"""
    # Filter only positive changes
    up_movers = [r for r in results if r["daily_change_pct"] > 0]
    # Sort by daily change descending
    up_movers.sort(key=lambda x: x["daily_change_pct"], reverse=True)
    return up_movers[:top_n]


def save_top_movers(top_movers, period="daily"):
    """Save top movers to JSON file"""
    output = {
        "generated_at": datetime.now().isoformat(),
        "period": period,
        "top_movers": top_movers
    }
    
    output_file = OUTPUT_DIR / f"top_movers_{period}.json"
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)
    
    print(f"Saved {len(top_movers)} top {period} movers to {output_file}")
    return output_file


def main():
    """
    This script is designed to work with quote data fetched via Kite MCP tools.
    The MCP tools are already authenticated via the user's Kite login.
    
    To use:
    1. Use the Kite MCP tools (mcp1_get_quotes) to fetch quotes for NIFTY_50_STOCKS
    2. Paste the JSON output into a file (e.g., quotes.json)
    3. Run this script to process and save top movers
    """
    
    # For now, this is a placeholder that shows the processing logic
    # In a real implementation, you'd load quotes from a file or API
    print("=" * 70)
    print("TOP MOVERS PROCESSOR")
    print("=" * 70)
    print("\nThis script processes quote data to find top up movers.")
    print("Quote data should be fetched via Kite MCP tools (already authenticated).")
    print("\nUsage:")
    print("1. Fetch quotes using Kite MCP: mcp1_get_quotes for NIFTY_50_STOCKS")
    print("2. Save the JSON output to data/quotes.json")
    print("3. Run this script to process and save top_movers_daily.json")
    print("\n" + "=" * 70)


if __name__ == "__main__":
    main()
