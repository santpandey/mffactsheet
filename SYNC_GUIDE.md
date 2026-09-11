# Sync All Funds - Quick Start Guide

## 🚀 One-Command Sync

**No existing script found - Created `sync_all_funds.py`!**

This is your **starter script** that syncs data from both funds automatically.

---

## ⚡ Quick Usage

### **Basic Sync (Recommended)**
```powershell
# Sync latest month for all funds
uv run python scripts/sync_all_funds.py
```

This single command will:
1. ✅ Download Canara Robeco (latest month)
2. ⚠️ Remind you to download Mirae Asset manually
3. ✅ Extract all data to JSON
4. ✅ Verify data quality
5. ✅ Show summary report

---

## 📋 All Options

### **Sync Last 3 Months**
```powershell
uv run python scripts/sync_all_funds.py --months 3
```

### **Sync Specific Month**
```powershell
uv run python scripts/sync_all_funds.py --year 2026 --month 2
```

### **Force Re-download**
```powershell
# Re-download even if files exist
uv run python scripts/sync_all_funds.py --force
```

### **Skip Steps**
```powershell
# Skip extraction (if you only want to download)
uv run python scripts/sync_all_funds.py --skip-extraction

# Skip verification
uv run python scripts/sync_all_funds.py --skip-verification
```

---

## 🎯 What It Does

### **Canara Robeco (Automated)**
- ✅ Downloads Excel file from website
- ✅ Validates fund name and data
- ✅ Handles pagination (searches 10 pages)
- ✅ Supports fund name changes (Emerging Equities → Large and Mid Cap)
- ✅ Logs all operations

### **Mirae Asset (Manual Reminder)**
- ⚠️ Shows reminder to download manually
- ℹ️ Provides download URL and instructions
- ✅ Extracts after you download

### **Data Processing**
- ✅ Extracts all Excel files to JSON
- ✅ Processes both funds automatically
- ✅ Verifies data quality
- ✅ Shows summary statistics

---

## 📊 Output Example

```
╔════════════════════════════════════════════════════════════════════╗
║               MUTUAL FUND DATA SYNC SCRIPT                         ║
╚════════════════════════════════════════════════════════════════════╝

Started at: 2026-02-16 16:07:30
Log file: logs/sync_all_funds_20260216_160730.log

Syncing 1 month(s):
  - February 2026

══════════════════════════════════════════════════════════════════════
SYNCING: Canara Robeco Large and Mid Cap Fund
══════════════════════════════════════════════════════════════════════
  [Canara] Searching pagination 1...
  [Canara] [MATCH] Found download link
  [Canara] Downloaded 102,935 bytes
  [Canara] [OK] File validation passed
  [Canara] [OK] Data extraction completed
✓ Canara Robeco sync completed successfully

══════════════════════════════════════════════════════════════════════
MANUAL ACTION REQUIRED: Mirae Asset Large & Midcap Fund
══════════════════════════════════════════════════════════════════════

Mirae Asset requires manual download:
  1. Visit: https://www.miraeassetmf.co.in/downloads/portfolio
  2. Download 'Mirae Asset Large & Midcap Fund' for desired month
  3. Save to: excel-data/mirae-asset/maebf-{month}{year}.xlsx

After downloading, this script will automatically extract the data.

══════════════════════════════════════════════════════════════════════
EXTRACTING: All fund data to JSON
══════════════════════════════════════════════════════════════════════
  [Extract] Completed: 17/17 files processed successfully
✓ Data extraction completed successfully

══════════════════════════════════════════════════════════════════════
VERIFYING: Data quality
══════════════════════════════════════════════════════════════════════
[Verification results...]

╔════════════════════════════════════════════════════════════════════╗
║                         SYNC SUMMARY                               ║
╚════════════════════════════════════════════════════════════════════╝

Canara Robeco:
  ✓ Successful: 1

Mirae Asset:
  ⚠ Manual download required

Data Extraction: ✓ Success
Data Verification: ✓ Success

Completed at: 2026-02-16 16:08:15
Log saved to: logs/sync_all_funds_20260216_160730.log

✓ Sync completed successfully
```

---

## 🔄 Typical Workflow

### **Monthly Update (5th of each month)**

```powershell
# Step 1: Run sync script
uv run python scripts/sync_all_funds.py

# Step 2: Download Mirae Asset manually (when prompted)
# - Visit website
# - Download file
# - Save to excel-data/mirae-asset/

# Step 3: Run sync again to extract Mirae Asset
uv run python scripts/sync_all_funds.py --skip-verification

# Step 4: Refresh browser to see new data
```

### **Catch Up Multiple Months**

```powershell
# Download last 3 months
uv run python scripts/sync_all_funds.py --months 3

# Then manually download Mirae Asset for those months
# Run extraction
uv run python scripts/extract_all_funds.py
```

---

## 📝 Logs

All operations are logged to:
```
logs/sync_all_funds_YYYYMMDD_HHMMSS.log
```

Check logs if:
- Download fails
- Extraction has errors
- Need to debug issues

---

## ⚙️ Advanced Options

### **Dry Run (Check without downloading)**
```powershell
# Canara Robeco script supports dry-run
uv run python scripts/canara_auto_download.py --year 2026 --month 2 --dry-run
```

### **Only Extract (No download)**
```powershell
uv run python scripts/extract_all_funds.py
```

### **Only Verify (No download/extract)**
```powershell
uv run python scripts/verify_data.py
```

---

## 🆚 Comparison: Old vs New

### **Before (Multiple Commands)**
```powershell
# Download Canara Robeco
uv run python scripts/canara_auto_download.py --year 2026 --month 1

# Download Canara Robeco for another month
uv run python scripts/canara_auto_download.py --year 2026 --month 2

# Download Canara Robeco for yet another month
uv run python scripts/canara_auto_download.py --year 2026 --month 3

# Manually download Mirae Asset...

# Extract all
uv run python scripts/extract_all_funds.py

# Verify
uv run python scripts/verify_data.py
```

### **After (One Command)**
```powershell
# Sync last 3 months for all funds
uv run python scripts/sync_all_funds.py --months 3

# Done! (except manual Mirae Asset download)
```

---

## 🎯 Benefits

1. **Single Command**: No need to remember multiple scripts
2. **Auto-Detection**: Automatically determines latest month
3. **Batch Processing**: Download multiple months at once
4. **Comprehensive Logging**: All operations logged to file
5. **Summary Report**: Clear success/failure status
6. **Error Handling**: Continues even if one month fails
7. **Flexible Options**: Skip steps, force re-download, etc.

---

## 🔧 Troubleshooting

### **"Command not found"**
Make sure you're in the project directory:
```powershell
cd d:\mffactsheet
```

### **"Module not found"**
Ensure the uv environment is synced:
```powershell
uv sync
```

### **Download fails**
- Check internet connection
- Verify month/year is valid
- Check logs for detailed error
- File might not be published yet (wait until 5th)

### **Extraction fails**
- Verify Excel files exist in `excel-data/`
- Check file format (should have 'EQ' or 'MAEBF' sheet)
- Run with verbose logging

---

## 📚 Related Documentation

- **[README.md](../README.md)**: Main project documentation
- **[WORKFLOW_GUIDE.md](../WORKFLOW_GUIDE.md)**: Detailed workflow
- **[MIRAE_ASSET_DOWNLOAD_GUIDE.md](../MIRAE_ASSET_DOWNLOAD_GUIDE.md)**: Mirae Asset instructions

---

## 🎓 Pro Tips

1. **Set up a monthly reminder** on your calendar for the 5th
2. **Run with `--months 2`** to catch any missed months
3. **Check logs** if something doesn't look right
4. **Use `--force`** if you need to re-download corrupted files
5. **Bookmark the Mirae Asset download page** for quick access

---

## ✅ Quick Reference Card

```powershell
# Most common usage
uv run python scripts/sync_all_funds.py

# Sync multiple months
uv run python scripts/sync_all_funds.py --months 3

# Specific month
uv run python scripts/sync_all_funds.py --year 2026 --month 2

# Force re-download
uv run python scripts/sync_all_funds.py --force

# Help
uv run python scripts/sync_all_funds.py --help
```

**Save this command to a shortcut for even faster access!**
