# Project Overview: Mutual Fund Portfolio Tracker

## 🎯 Purpose

This application tracks and visualizes mutual fund portfolio holdings over time, enabling investors to:
- Monitor allocation changes month-over-month
- Identify new entries and exits
- Track individual stock trends
- Compare portfolio composition across time periods

## 🏗️ Architecture

### Three-Tier System

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (Browser)                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │  index.html  │  │   Chart.js   │  │  app-multi-  │  │
│  │              │  │   Rendering  │  │   fund.js    │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────┘
                           ↕
┌─────────────────────────────────────────────────────────┐
│                   Data Layer (JSON)                      │
│  ┌──────────────────────────────────────────────────┐   │
│  │  data/                                           │   │
│  │  ├── CanaraRobecoLargeAndMidCapFund-*.json      │   │
│  │  └── MiraeAssetLargeAndMidcapFund-*.json        │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
                           ↕
┌─────────────────────────────────────────────────────────┐
│              Backend (Python Scripts)                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │   Download   │  │  Extraction  │  │  Validation  │  │
│  │   Scripts    │→ │   Scripts    │→ │   Scripts    │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────┘
```

## 📦 Components

### 1. Download Automation

**Canara Robeco** (`scripts/canara_auto_download.py`):
- ✅ Fully automated web scraping
- ✅ Pagination support (10 pages)
- ✅ Fund name change handling (Emerging Equities → Large and Mid Cap)
- ✅ Validation and retry logic
- ✅ Auto-extraction after download
- ✅ Scheduled monthly execution

**Mirae Asset** (`scripts/mirae_auto_download.py`):
- ⚠️ Manual download required (JavaScript-rendered website)
- ✅ Pagination support implemented
- ✅ Auto-extraction after manual download

### 2. Data Extraction

**Multi-Fund Extractor** (`scripts/extract_all_funds.py`):
- Processes both Canara Robeco and Mirae Asset Excel files
- Extracts 85-100+ holdings per month
- Normalizes company names (handles variations like "Ltd." vs "Limited")
- Handles decimal vs percentage formats automatically
- Merges duplicate entries within same month
- Generates JSON output for web consumption

**Key Features:**
- Generic pattern-based normalization (no hardcoded fixes)
- Automatic format detection
- Comprehensive error handling
- Detailed logging

### 3. Web Interface

**Multi-Fund Dashboard** (`index.html` + `js/app-multi-fund.js`):
- Fund switching capability
- Interactive charts (pie, bar, line)
- Delta comparison between any two months
- Top 5 holdings trend visualization
- Individual stock tracking
- Search and filter functionality
- Responsive design

**UI Enhancements:**
- Modern Tailwind-inspired styling
- Smooth animations and transitions
- Professional color scheme
- Mobile-responsive layout

## 🔄 Data Flow

### Automated Flow (Canara Robeco)

```
1. Scheduled Task (5th of month)
   ↓
2. canara_auto_download.py
   - Searches 10 pages for download link
   - Downloads Excel file
   - Validates fund name and data
   ↓
3. extract_all_funds.py (auto-triggered)
   - Extracts holdings from Excel
   - Normalizes company names
   - Generates JSON
   ↓
4. Web Dashboard
   - Loads JSON files
   - Renders charts and tables
```

### Manual Flow (Mirae Asset)

```
1. User downloads from website
   ↓
2. User saves to excel-data/mirae-asset/
   ↓
3. User runs extract_all_funds.py
   ↓
4. Web Dashboard
   - Loads JSON files
   - Renders charts and tables
```

## 🎨 Design Decisions

### Why JSON over Database?
- **Simplicity**: No database setup required
- **Portability**: Easy to version control and share
- **Performance**: Fast loading for small datasets
- **Transparency**: Human-readable data format

### Why Vanilla JavaScript?
- **No Build Step**: Direct browser execution
- **Lightweight**: Fast page loads
- **Maintainability**: No framework dependencies
- **Learning**: Clear, understandable code

### Why Python for Backend?
- **Rich Libraries**: BeautifulSoup, pandas, openpyxl
- **Scripting**: Easy automation and scheduling
- **Data Processing**: Excellent for ETL operations

## 🔐 Security & Privacy

- **No External APIs**: All data processed locally
- **No User Data**: No personal information collected
- **Public Data Only**: Uses publicly available factsheets
- **No Authentication**: Static site, no login required

## 📈 Scalability

### Current Limitations
- **Manual Mirae Asset Downloads**: Website limitation
- **Single-User**: Not designed for multi-user access
- **Local Storage**: JSON files in repository

### Future Enhancements
- **Selenium/Playwright**: Automate Mirae Asset downloads
- **Database Integration**: For larger datasets
- **API Layer**: RESTful API for data access
- **Cloud Deployment**: Host on cloud platform
- **More Funds**: Add support for additional mutual funds

## 🧪 Testing Strategy

### Current Testing
- **Manual Testing**: UI and download scripts
- **Validation Scripts**: Data quality checks
- **Error Logging**: Comprehensive logging for debugging

### Recommended Additions
- **Unit Tests**: For extraction logic
- **Integration Tests**: For download workflows
- **E2E Tests**: For UI interactions
- **CI/CD Pipeline**: Automated testing on commits

## 📊 Performance Metrics

### Download Performance
- **Canara Robeco**: ~30 seconds (including extraction)
- **Pagination**: 1 second delay between pages
- **Retry Logic**: 3 attempts with exponential backoff

### Extraction Performance
- **Processing Time**: ~5 seconds for all files
- **Holdings Extracted**: 85-100+ per month
- **Data Accuracy**: ~99% NAV coverage

### UI Performance
- **Page Load**: < 1 second
- **Chart Rendering**: < 500ms
- **Data Switching**: Instant (cached in memory)

## 🛣️ Roadmap

### Phase 1: Core Functionality ✅
- [x] Multi-fund support
- [x] Automated downloads (Canara Robeco)
- [x] Data extraction
- [x] Interactive dashboard
- [x] Delta comparison
- [x] Top 5 holdings trend

### Phase 2: Enhancements (Current)
- [x] Modern UI design
- [x] Comprehensive documentation
- [x] Error handling improvements
- [ ] Automated Mirae Asset downloads (Selenium)
- [ ] Unit tests

### Phase 3: Advanced Features (Future)
- [ ] Portfolio performance tracking
- [ ] Sector allocation analysis
- [ ] Benchmark comparison
- [ ] Export to PDF/Excel
- [ ] Email notifications for changes
- [ ] Mobile app

## 📝 Maintenance

### Regular Tasks
- **Monthly**: Verify automated downloads
- **Quarterly**: Review and update documentation
- **Annually**: Update dependencies

### Known Issues
- Mirae Asset requires manual download (website limitation)
- Fund name changes require script updates (handled for Canara Robeco)

## 🤝 Contribution Guidelines

### Code Style
- **Python**: PEP 8 compliant
- **JavaScript**: ES6+ with clear naming
- **Comments**: Explain "why", not "what"

### Adding New Funds
1. Create download script (use existing as template)
2. Add fund config to `extract_all_funds.py`
3. Update UI with fund selector
4. Test extraction and validation
5. Document in README

### Submitting Changes
1. Test locally
2. Update documentation
3. Commit with clear message
4. Create pull request

## 📞 Support

For issues or questions:
1. Check documentation files
2. Review logs in `logs/` directory
3. Verify data in `data/` directory
4. Check browser console for UI errors

## 🎓 Learning Resources

This project demonstrates:
- **Web Scraping**: BeautifulSoup, pagination, error handling
- **Data Processing**: pandas, openpyxl, normalization
- **Frontend Development**: Vanilla JS, Chart.js, responsive design
- **Automation**: Task scheduling, retry logic, validation
- **Documentation**: Comprehensive guides and README

Perfect for learning full-stack development with practical financial data!
