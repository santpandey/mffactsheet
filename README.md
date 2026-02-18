# Mutual Fund Allocation Tracker

A web application to track and visualize changes in mutual fund holdings over time. Currently configured for **Mirae Asset Large & Midcap Fund**.

## Features

- **Complete Holdings Extraction**: Extracts 85-94 stocks per month (~99% NAV coverage)
- **Monthly Allocation View**: Pie and bar charts showing top holdings
- **Delta Comparison**: Compare **all holdings** between any two months:
  - New entries (stocks added)
  - Exited positions (stocks removed)
  - Changed positions (NAV % increased/decreased)
- **Interactive Table**: Search, sort, and filter all holdings
- **Historical Trends**: Track individual stocks across all months
- **Statistics**: Top holdings, concentration metrics

## Project Structure

```
mffactsheet/
├── venv/                              # Python virtual environment
├── data/                              # Extracted JSON data files
├── excel-data/                        # Source Excel factsheets
├── pdfs/                              # PDF factsheets (legacy)
├── scripts/
│   ├── extract_from_excel_pandas.py   # Excel extraction script (primary)
│   ├── verify_data.py                 # Data quality verification
│   └── run_extraction.py              # PDF extraction (legacy)
├── js/
│   └── app.js                         # Main application logic
├── css/
│   └── styles.css                     # Styling
├── index.html                         # Main dashboard
├── requirements.txt                   # Python dependencies
├── requirements-download.txt          # Python dependencies for download
└── README.md                          # This file
```

## Setup Instructions

### Prerequisites

- Python 3.9+ installed
- A modern web browser (Chrome, Firefox, Edge)
- Git (for cloning the repository)

### Step 1: Clone and Setup

```powershell
git clone <repository-url>
cd mffactsheet
.\venv\Scripts\activate
pip install -r requirements.txt
pip install -r requirements-download.txt
```

### Step 2: Start Servers

**Easy Way (Recommended):**

```powershell
# Starts both web server and sync API
.\start_server.bat
```

**Manual Way:**

```powershell
# Terminal 1: Sync API Server
.\venv\Scripts\python.exe scripts\sync_server.py

# Terminal 2: Web Server
.\venv\Scripts\python.exe -m http.server 8000
```

Then open: http://localhost:8000

### Step 3: Extract Data from Excel Factsheets

Place Excel factsheets in the `excel-data/` folder, then run:

```powershell
python scripts/extract_all_funds.py
```

This will:

1. Read all Excel files from `excel-data/` folder
2. Extract **all equity holdings** (85-94 stocks per month)
3. Save data as JSON files in the `data/` folder

**Verify extraction:**

```powershell
python scripts/verify_data.py
```

This shows holdings count and data quality for each month.

### Step 4: Start a Local Web Server

You need a local web server to serve the files (due to browser security restrictions on loading local JSON files).

**Option A: Python HTTP Server (Recommended)**

```powershell
cd d:\mffactsheet
python -m http.server 8000
```

**Option B: Node.js (if installed)**

```powershell
npx serve .
```

**Option C: VS Code Live Server Extension**

- Install the "Live Server" extension
- Right-click on `index.html` → "Open with Live Server"

### Step 5: Open the Dashboard

Open your browser and navigate to:

```
http://localhost:8000
```

## Usage

1. **Select Month**: Use the dropdown to view holdings for a specific month
2. **Compare Months**: Select a previous month and click "Show Delta" to see changes
3. **Search**: Filter holdings by company name
4. **Sort**: Sort by NAV %, shares, or company name

## Data Format

Each JSON file in `data/` follows this structure:

```json
{
  "fundName": "Mirae Asset Large & Midcap Fund",
  "month": "January",
  "year": 2025,
  "extractedAt": "2025-01-15T10:30:00",
  "holdingsCount": 65,
  "holdings": [
    {
      "company": "HDFC Bank Ltd",
      "shares": 1234567,
      "percentOfNAV": 8.5,
      "value": 123456789
    }
  ]
}
```

## 🔧 Troubleshooting

### "No Data Found" message

- Run extraction: `.\venv\Scripts\python.exe scripts/extract_all_funds.py`
- Check that JSON files exist in `data/` folder
- Verify file naming: `{FundKey}-{Month}-{Year}.json`

### Download fails (Canara Robeco)

- Check internet connection
- Verify month/year parameters
- Check logs in `logs/canara_download_YYYYMM.log`
- File might not be published yet (wait until 5th of month)

### Extraction fails

- Verify Excel file format (should have 'EQ' or 'MAEBF' sheet)
- Check file is not corrupted
- Run with verbose output to see detailed errors

### Charts not loading

- Ensure you're using a local web server (not file:// protocol)
- Check browser console for JavaScript errors
- Verify Chart.js CDN is accessible

### Fund name validation fails

- Canara Robeco accepts both "Large and Mid Cap Fund" and "Emerging Equities" (old name)
- Check logs for actual fund name found in file

## 🛠️ Technical Stack

### Frontend

- **Framework**: Vanilla JavaScript (ES6+)
- **Charting**: Chart.js 4.x
- **Styling**: Custom CSS with Tailwind-inspired design
- **Data Format**: JSON

### Backend/Automation

- **Language**: Python 3.9+
- **Web Scraping**: BeautifulSoup4, Requests
- **Excel Processing**: openpyxl, pandas
- **Scheduling**: Windows Task Scheduler
- **Logging**: Python logging module

### Key Features

- **Pagination Support**: Searches up to 10 pages for downloads
- **Fund Name Handling**: Supports historical name changes
- **Data Validation**: Comprehensive file and content validation
- **Auto-Extraction**: Runs extraction after successful download
- **Error Recovery**: Retry logic with exponential backoff

## 📚 Documentation

- **[README_SYNC.md](README_SYNC.md)**: Sync button feature and API documentation
- **[SYNC_GUIDE.md](SYNC_GUIDE.md)**: Sync script usage and examples
- **[WORKFLOW_GUIDE.md](WORKFLOW_GUIDE.md)**: Complete download and extraction workflow
- **[MIRAE_ASSET_DOWNLOAD_GUIDE.md](MIRAE_ASSET_DOWNLOAD_GUIDE.md)**: Mirae Asset specific instructions
- **[PROJECT_OVERVIEW.md](PROJECT_OVERVIEW.md)**: Architecture and design decisions

## 🤝 Contributing

This is a personal project for tracking mutual fund portfolios. Feel free to fork and adapt for your own funds.

### Adding New Funds

1. Create download script in `scripts/{fund}_auto_download.py`
2. Add fund configuration to `scripts/extract_all_funds.py`
3. Update `js/app-multi-fund.js` with fund key and display name
4. Test extraction and UI integration

## 📊 Data Coverage

**Canara Robeco Large and Mid Cap Fund:**

- February 2025 - December 2025 (11 months)
- ~100 holdings per month

**Mirae Asset Large & Midcap Fund:**

- July 2025 - December 2025 (6 months)
- ~85-90 holdings per month

## 📄 License

For educational and personal use only. Data sourced from publicly available mutual fund factsheets.

## 🙏 Acknowledgments

- Canara Robeco Mutual Fund for transparent portfolio disclosures
- Mirae Asset Mutual Fund for accessible portfolio data
- Chart.js for excellent charting library
