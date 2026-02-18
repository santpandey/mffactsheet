# Canara Robeco Auto-Download System

## Overview

Automated system to download Canara Robeco monthly portfolio files with validation and safeguards.

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│ Scheduler (Windows Task Scheduler / APScheduler / Cron)      │
│ Runs: 5th of each month at 6:00 AM                          │
└────────────────────────┬─────────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────────┐
│ canara_auto_download.py                                      │
│ • Auto-detects target month (previous month)                 │
│ • Searches pagination 1-10 for fund                          │
│ • Downloads with retry logic (3 attempts)                    │
│ • Validates file integrity                                   │
└────────────────────────┬─────────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────────┐
│ Validation & Safeguards                                      │
│ ✓ Check if file already exists (skip duplicate)             │
│ ✓ Verify Excel format (openpyxl can open)                   │
│ ✓ Check sheet name = 'EQ'                                   │
│ ✓ Verify fund name in content                               │
│ ✓ Check file size > 50KB                                    │
│ ✓ Verify holdings count > 50                                │
│ ✓ Detailed logging to logs/canara_download_YYYYMM.log       │
└────────────────────────┬─────────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────────┐
│ Output: excel-data/canara-robeco/EQ-...-Month-Year.xlsx     │
└──────────────────────────────────────────────────────────────┘
```

## Installation

### 1. Install Dependencies

```powershell
.\venv\Scripts\activate
pip install requests beautifulsoup4 openpyxl
```

### 2. Setup Scheduler

**Option A: Windows Task Scheduler (Recommended for Windows)**

```powershell
python scripts/setup_scheduler.py
```

This creates a scheduled task that runs on the 5th of each month at 6 AM.

**Option B: Python Scheduler (Cross-platform)**

```powershell
pip install apscheduler
python scripts/run_scheduler.py
```

Keep this running in the background.

**Option C: Manual Cron (Linux/Mac)**

```bash
crontab -e
# Add: 0 6 5 * * /path/to/python /path/to/canara_auto_download.py
```

## Usage

### Automatic (Scheduled)

Once setup, the system runs automatically on the 5th of each month.

### Manual Download

**Download current target month (auto-detected):**

```powershell
python scripts/canara_auto_download.py
```

**Download specific month:**

```powershell
python scripts/canara_auto_download.py --year 2026 --month 1
```

**Force re-download:**

```powershell
python scripts/canara_auto_download.py --force
```

**Test without downloading:**

```powershell
python scripts/canara_auto_download.py --dry-run
```

## How It Works

### 1. Month Detection

- Runs on 5th of each month
- Automatically downloads **previous month's** data
- Example: Running on Feb 5, 2026 → Downloads January 2026 data

### 2. Download Process

1. **Search**: Iterates through pagination=1,2,3... (max 10 pages)
2. **Find**: Looks for "Canara Robeco Large and Mid Cap Fund" link
3. **Download**: Downloads Excel file with retry logic
4. **Validate**: Checks file integrity and content
5. **Save**: Saves to `excel-data/canara-robeco/` if valid

### 3. Safeguards

| Safeguard              | Description                         |
| ---------------------- | ----------------------------------- |
| **Duplicate Check**    | Skips if file already exists        |
| **Format Validation**  | Ensures it's a valid Excel file     |
| **Sheet Verification** | Checks for 'EQ' sheet               |
| **Content Check**      | Verifies fund name in content       |
| **Size Check**         | Ensures file > 50KB                 |
| **Holdings Count**     | Verifies > 50 holdings rows         |
| **Retry Logic**        | 3 attempts with exponential backoff |
| **Logging**            | Detailed logs in `logs/` directory  |

### 4. Error Handling

**If download fails:**

- Retries up to 3 times
- Logs detailed error messages
- Exits with error code (for monitoring)

**If validation fails:**

- Removes invalid file
- Logs validation errors
- Does not proceed to extraction

**If website blocks:**

- Uses proper User-Agent headers
- Implements polite delays between requests
- May require manual intervention if anti-bot is strong

## Monitoring

### Check Logs

```powershell
# View latest log
Get-Content logs\canara_download_*.log -Tail 50

# View all logs
Get-ChildItem logs\canara_download_*.log | Sort-Object LastWriteTime -Descending
```

### Check Task Status (Windows)

```powershell
# View task
schtasks /Query /TN CanaraRobecoAutoDownload /V /FO LIST

# Run manually
schtasks /Run /TN CanaraRobecoAutoDownload

# View task history
Get-ScheduledTask -TaskName CanaraRobecoAutoDownload | Get-ScheduledTaskInfo
```

## Troubleshooting

### Website Blocks Requests (403 Forbidden)

**Problem**: Website detects automation and blocks requests.

**Solutions**:

1. **Use browser automation** (Selenium/Playwright):

   ```python
   # Install: pip install playwright
   # Setup: playwright install chromium
   ```

   Update script to use headless browser instead of requests.

2. **Manual download + auto-extract**:
   - Download manually on 5th of month
   - Place in `excel-data/canara-robeco/`
   - Run `extract_all_funds.py` automatically

3. **Add delays and randomization**:
   - Increase delays between pagination
   - Randomize User-Agent strings
   - Use residential proxies (if needed)

### Download Link Not Found

**Problem**: Pagination search doesn't find the fund.

**Solutions**:

- Increase `MAX_PAGINATION` in script
- Check if website structure changed
- Verify fund name pattern is correct
- Run with `--dry-run` to test

### Validation Fails

**Problem**: Downloaded file fails validation.

**Solutions**:

- Check logs for specific validation error
- Manually inspect downloaded file
- Adjust validation thresholds if needed
- Verify file format hasn't changed

## Integration with Extraction

### Auto-Extract After Download

Add to end of `canara_auto_download.py`:

```python
if success:
    logger.info("Running extraction...")
    import subprocess
    result = subprocess.run(
        [sys.executable, "scripts/extract_all_funds.py"],
        cwd=PROJECT_ROOT
    )
    if result.returncode == 0:
        logger.info("✓ Extraction completed")
    else:
        logger.error("✗ Extraction failed")
```

### Email Notifications

Install: `pip install yagmail`

```python
import yagmail

def send_notification(success: bool, details: str):
    yag = yagmail.SMTP('your-email@gmail.com', 'app-password')
    subject = "✓ Canara Download Success" if success else "✗ Canara Download Failed"
    yag.send('recipient@email.com', subject, details)
```

## Best Practices

1. **Test First**: Always run with `--dry-run` before scheduling
2. **Monitor Logs**: Check logs regularly for failures
3. **Backup Files**: Keep backups of downloaded files
4. **Update Headers**: Update User-Agent if website blocks
5. **Manual Fallback**: Have manual download process ready
6. **Validate Output**: Check extracted JSON after download

## File Naming Convention

Downloaded files follow this pattern:

```
EQ-–-Canara-Robeco-Large-and-Mid-Cap-Fund-–-{Month}-{Year}.xlsx
```

Example:

```
EQ-–-Canara-Robeco-Large-and-Mid-Cap-Fund-–-January-2026.xlsx
```

## Security Considerations

- **No credentials stored**: Script doesn't store passwords
- **Read-only access**: Only downloads public data
- **Local storage**: Files stored locally, not uploaded
- **Minimal permissions**: Runs with user privileges
- **Audit trail**: All actions logged

## Future Enhancements

1. **Browser Automation**: Add Selenium/Playwright for JS-heavy sites
2. **Proxy Support**: Rotate IPs if needed
3. **Email Alerts**: Send notifications on success/failure
4. **Dashboard**: Web UI to monitor downloads
5. **Multi-Fund**: Extend to other funds
6. **Cloud Storage**: Auto-upload to cloud backup

## Support

For issues or questions:

1. Check logs in `logs/` directory
2. Run with `--dry-run` to test
3. Verify website structure hasn't changed
4. Check Task Scheduler history (Windows)

---

**Last Updated**: January 18, 2026
