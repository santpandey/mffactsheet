@echo off
REM ============================================================
REM   MUTUAL FUND DATA SYNC - ONE-CLICK SCRIPT
REM ============================================================
REM   This script syncs the latest monthly data for all funds
REM   and automatically commits it to git.
REM ============================================================

echo.
echo ========================================
echo   Monthly Mutual Fund Data Sync
echo ========================================
echo.

REM Step 1: Activate virtual environment and run sync
echo [1/4] Syncing latest data from all fund websites...
echo.
call venv\Scripts\activate.bat
python scripts\sync_all_funds.py
if %errorlevel% neq 0 (
    echo.
    echo ERROR: Sync failed! Check logs in logs\ directory
    pause
    exit /b 1
)

echo.
echo [2/4] Running data extraction...
python scripts\extract_all_funds.py
if %errorlevel% neq 0 (
    echo.
    echo ERROR: Extraction failed!
    pause
    exit /b 1
)

echo.
echo [3/4] Checking what files changed...
git status --short data/

echo.
echo [4/4] Ready to commit changes
echo.
echo ========================================
echo   NEXT STEPS:
echo ========================================
echo.
echo   Review the changes above, then run:
echo.
echo   git add data/
echo   git commit -m "Update fund data for [Month YYYY]"
echo   git push
echo.
echo   Your changes will auto-deploy to Netlify!
echo.
pause
