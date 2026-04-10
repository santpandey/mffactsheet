# Canara Robeco Download & Extraction Workflow Guide

## ✅ Simplified Workflow (After Update)

### **Manual Download (One Command)**

```powershell
# Download for a specific month - extraction happens automatically!
.\venv\Scripts\python.exe scripts/canara_auto_download.py --year 2025 --month 4

# That's it! The script will:
# 1. Download the Excel file
# 2. Validate it
# 3. Automatically extract to JSON
# 4. You're done! ✅
```

### **Automated Monthly Download (Scheduled)**

The scheduled task runs automatically on the 5th of each month and:

1. Downloads previous month's data
2. Validates the file
3. **Automatically extracts to JSON**
4. Logs everything

**No manual intervention needed!**

---

## 📋 Command Reference

### Start Development Server

```powershell
# Start local web server (run from project root)
venv\Scripts\python.exe -m http.server 8000

# Then open: http://localhost:8000
```

**Note:** Server must be running to view the dashboard (browser security restrictions on local JSON files).

### Download Specific Month

```powershell
# Download and extract April 2025
.\venv\Scripts\python.exe scripts/canara_auto_download.py --year 2025 --month 4
```

### Force Re-download

```powershell
# Re-download even if file exists
.\venv\Scripts\python.exe scripts/canara_auto_download.py --year 2025 --month 4 --force
```

### Manual Extraction Only

```powershell
# If you only want to re-extract existing Excel files
.\venv\Scripts\python.exe scripts/extract_all_funds.py
```

---

## 🔄 How Auto-Extraction Works

**After successful download:**

1. ✅ File downloaded and validated
2. 🔄 Script automatically runs `extract_all_funds.py`
3. 📊 JSON files generated in `data/` folder
4. ✅ Ready to view in UI immediately

**The extraction script:**

- Processes **all** Excel files (both Mirae Asset and Canara Robeco)
- Skips files with errors gracefully
- Overwrites existing JSON (always fresh data)
- Takes ~5 seconds to process all files

---

## 📊 What Gets Extracted

**From:** `excel-data/canara-robeco/*.xlsx`  
**To:** `data/CanaraRobecoLargeAndMidCapFund-{Month}-{Year}.json`

**From:** `excel-data/mirae-asset/*.xlsx`  
**To:** `data/MiraeAssetLargeAndMidcapFund-{Month}-{Year}.json`

---

## ❓ FAQ

### Q: Do I need to run extraction manually?

**A:** No! After the update, extraction runs automatically after every successful download.

### Q: What if extraction fails?

**A:** The download still succeeds. You'll see a warning and can run extraction manually:

```powershell
.\venv\Scripts\python.exe scripts/extract_all_funds.py
```

### Q: Does extraction skip already-processed files?

**A:** No, it re-processes all files every time. This ensures data is always fresh and takes only ~5 seconds.

### Q: Can I disable auto-extraction?

**A:** Currently no, but it's fast and harmless. If needed, you can modify `canara_auto_download.py`.

### Q: What about the scheduled monthly task?

**A:** It now automatically extracts too! No manual steps needed.

---

## 🎯 Complete Workflow Example

### Scenario: Download March 2025 data

```powershell
# Step 1: Run download (extraction happens automatically)
.\venv\Scripts\python.exe scripts/canara_auto_download.py --year 2025 --month 3

# Output:
# ✅ Downloaded and validated
# 🔄 Running extraction...
# ✅ Data extraction completed successfully
# ✅ Download completed successfully

# Step 2: Refresh browser
# Done! March 2025 data is now visible in the UI
```

**Before the update:** 2 commands  
**After the update:** 1 command ✅

---

## 🔧 Troubleshooting

### Extraction fails but download succeeds

```powershell
# Manually run extraction
.\venv\Scripts\python.exe scripts/extract_all_funds.py
```

### Want to see extraction output

The output is captured but not shown. Check:

- `logs/canara_download_YYYYMM.log` for download logs
- Console output shows "[OK] Data extraction completed successfully"

### Re-extract all data

```powershell
# This processes all Excel files and regenerates all JSON
.\venv\Scripts\python.exe scripts/extract_all_funds.py
```

---

## 📈 Current Data Coverage

**Canara Robeco Large and Mid Cap Fund:**

- February 2025 ✅
- March 2025 ✅
- April 2025 ✅
- May 2025 ✅
- June 2025 ✅
- July 2025 ✅
- August 2025 ✅
- September 2025 ✅
- October 2025 ✅
- November 2025 ✅
- December 2025 ✅

**Total: 11 months**

**Mirae Asset Large & Midcap Fund:**

- 6 months (July - December 2025)

---

## 🚀 Benefits of Auto-Extraction

1. **Simpler workflow** - One command instead of two
2. **Fewer errors** - Can't forget to extract
3. **Immediate results** - Data ready right after download
4. **Scheduled tasks work** - Fully automated monthly updates
5. **Consistent behavior** - Same process for manual and scheduled runs

---

## 📝 Notes

- **Fund name change handled:** Script accepts both "Emerging Equities" (old name) and "Large and Mid Cap Fund" (new name)
- **Validation robust:** Checks fund name, file size, data rows, and Excel format
- **Extraction fast:** Processes all files in ~5 seconds
- **Logs detailed:** Everything logged to `logs/canara_download_YYYYMM.log`
