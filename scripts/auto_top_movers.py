"""
Automated Top Movers Fetcher and Notifier
Fetches top movers from Kite MCP and sends to Telegram
Scheduled to run Mon-Fri at 5 PM IST
"""

import json
import sys
from datetime import datetime
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

try:
    import requests
except ImportError:
    print("ERROR: requests not installed. Run: pip install requests")
    sys.exit(1)

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

# Paths
CONFIG_FILE = Path("config/top_movers_config.json")
OUTPUT_DIR = Path("data")
OUTPUT_DIR.mkdir(exist_ok=True)


def load_config():
    """Load configuration from JSON file"""
    if not CONFIG_FILE.exists():
        print(f"ERROR: Config file not found at {CONFIG_FILE}")
        print("Please create config/top_movers_config.json with your settings")
        sys.exit(1)
    
    with open(CONFIG_FILE, "r") as f:
        return json.load(f)


def calculate_daily_change(quote):
    """Calculate daily % change from previous close"""
    if not quote or not quote.get("ohlc") or not quote.get("ohlc").get("close"):
        return None
    prev_close = quote["ohlc"]["close"]
    last_price = quote.get("last_price")
    if not last_price or prev_close == 0:
        return None
    return round(((last_price - prev_close) / prev_close) * 100, 2)


def format_telegram_message(daily_movers, weekly_movers):
    """Format top movers data for Telegram message"""
    message = f"📈 *Top Up Movers - NIFTY Midcap 100*\n"
    message += f"🕐 {datetime.now().strftime('%Y-%m-%d %H:%M IST')}\n\n"
    
    if daily_movers:
        message += "*📊 Daily Top Movers:*\n"
        for i, mover in enumerate(daily_movers[:5], 1):
            change = mover.get("daily_change_pct", 0)
            sign = "+" if change >= 0 else ""
            message += f"{i}. {mover['symbol']}: {sign}{change}% (₹{mover['last_price']})\n"
        message += "\n"
    
    if weekly_movers:
        message += "*📅 Weekly Top Movers:*\n"
        for i, mover in enumerate(weekly_movers[:5], 1):
            change = mover.get("weekly_change_pct", 0)
            sign = "+" if change >= 0 else ""
            message += f"{i}. {mover['symbol']}: {sign}{change}% (₹{mover['last_price']})\n"
    
    return message


def send_telegram_message(message, bot_token, chat_id):
    """Send message via Telegram Bot API"""
    url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
    
    payload = {
        "chat_id": chat_id,
        "text": message,
        "parse_mode": "Markdown"
    }
    
    try:
        response = requests.post(url, json=payload, timeout=10)
        response.raise_for_status()
        print("✅ Telegram message sent successfully")
        return True
    except requests.exceptions.RequestException as e:
        print(f"❌ Error sending Telegram message: {e}")
        return False


def main():
    print("=" * 70)
    print("AUTOMATED TOP MOVERS FETCHER")
    print("=" * 70)
    
    # Load configuration
    config = load_config()
    
    # Check if it's a weekday
    today = datetime.now().strftime("%A")
    if today not in config["schedule"]["days"]:
        print(f"Skipping - Today is {today}, not a scheduled day")
        return
    
    print(f"Fetching top movers for {today}...")
    
    # Note: This script is a template for the automated version
    # The actual Kite MCP calls need to be integrated
    # For now, we'll load the existing JSON files and send them
    
    try:
        # Load existing top movers data
        daily_file = OUTPUT_DIR / "top_movers_daily.json"
        weekly_file = OUTPUT_DIR / "top_movers_weekly.json"
        
        daily_movers = []
        weekly_movers = []
        
        if daily_file.exists():
            with open(daily_file, "r") as f:
                daily_data = json.load(f)
                daily_movers = daily_data.get("top_movers", [])
        
        if weekly_file.exists():
            with open(weekly_file, "r") as f:
                weekly_data = json.load(f)
                weekly_movers = weekly_data.get("top_movers", [])
        
        if not daily_movers and not weekly_movers:
            print("❌ No top movers data found")
            return
        
        # Format and send Telegram message
        message = format_telegram_message(daily_movers, weekly_movers)
        
        bot_token = config["telegram"]["bot_token"]
        chat_id = config["telegram"]["chat_id"]
        
        if bot_token == "YOUR_TELEGRAM_BOT_TOKEN" or chat_id == "YOUR_TELEGRAM_CHAT_ID":
            print("⚠️  Please configure your Telegram bot token and chat_id in config/top_movers_config.json")
            print("\nMessage preview:")
            print(message)
        else:
            send_telegram_message(message, bot_token, chat_id)
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()
