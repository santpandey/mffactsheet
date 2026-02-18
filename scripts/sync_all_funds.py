"""
Unified Sync Script for All Mutual Funds
Downloads latest data from all supported funds and extracts to JSON

Usage:
    python scripts/sync_all_funds.py                    # Sync all funds (auto-detect months)
    python scripts/sync_all_funds.py --months 3         # Sync last 3 months
    python scripts/sync_all_funds.py --year 2026 --month 2  # Sync specific month
"""

import sys
import subprocess
import logging
from pathlib import Path
from datetime import datetime, timedelta
from typing import List, Tuple

# Setup logging
LOG_DIR = Path(__file__).parent.parent / "logs"
LOG_DIR.mkdir(exist_ok=True)
log_file = LOG_DIR / f"sync_all_funds_{datetime.now().strftime('%Y%m%d_%H%M%S')}.log"

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(log_file, encoding='utf-8'),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)


def get_recent_months(count: int = 3) -> List[Tuple[int, int]]:
    """
    Get list of recent months to sync.
    
    Args:
        count: Number of recent months to return
        
    Returns:
        List of (year, month) tuples
    """
    months = []
    current = datetime.now()
    
    for i in range(count):
        # Go back i months
        target = current - timedelta(days=30 * i)
        months.append((target.year, target.month))
    
    return months


def sync_canara_robeco(year: int = None, month: int = None, force: bool = False) -> bool:
    """
    Sync Canara Robeco fund data.
    
    Args:
        year: Target year (None for auto-detect)
        month: Target month (None for auto-detect)
        force: Force re-download even if exists
        
    Returns:
        True if successful, False otherwise
    """
    logger.info("="*70)
    logger.info("SYNCING: Canara Robeco Large and Mid Cap Fund")
    logger.info("="*70)
    
    script_path = Path(__file__).parent / "canara_auto_download.py"
    
    cmd = [sys.executable, str(script_path)]
    
    if year and month:
        cmd.extend(["--year", str(year), "--month", str(month)])
    
    if force:
        cmd.append("--force")
    
    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            cwd=Path(__file__).parent.parent
        )
        
        # Log output
        if result.stdout:
            for line in result.stdout.split('\n'):
                if line.strip():
                    logger.info(f"  [Canara] {line}")
        
        if result.returncode == 0:
            logger.info("✓ Canara Robeco sync completed successfully")
            return True
        else:
            logger.error(f"✗ Canara Robeco sync failed with exit code {result.returncode}")
            if result.stderr:
                logger.error(f"  Error: {result.stderr}")
            return False
            
    except Exception as e:
        logger.error(f"✗ Canara Robeco sync failed: {e}")
        return False


def sync_mirae_asset_manual_reminder():
    """
    Display reminder for manual Mirae Asset download.
    """
    logger.info("="*70)
    logger.info("MANUAL ACTION REQUIRED: Mirae Asset Large & Midcap Fund")
    logger.info("="*70)
    logger.info("")
    logger.info("Mirae Asset requires manual download:")
    logger.info("  1. Visit: https://www.miraeassetmf.co.in/downloads/portfolio")
    logger.info("  2. Download 'Mirae Asset Large & Midcap Fund' for desired month")
    logger.info("  3. Save to: excel-data/mirae-asset/maebf-{month}{year}.xlsx")
    logger.info("")
    logger.info("After downloading, this script will automatically extract the data.")
    logger.info("")


def extract_all_data() -> bool:
    """
    Run extraction script to process all Excel files.
    
    Returns:
        True if successful, False otherwise
    """
    logger.info("="*70)
    logger.info("EXTRACTING: All fund data to JSON")
    logger.info("="*70)
    
    script_path = Path(__file__).parent / "extract_all_funds.py"
    
    try:
        result = subprocess.run(
            [sys.executable, str(script_path)],
            capture_output=True,
            text=True,
            cwd=Path(__file__).parent.parent
        )
        
        # Log output
        if result.stdout:
            for line in result.stdout.split('\n'):
                if line.strip() and not line.startswith('Processing:'):
                    logger.info(f"  [Extract] {line}")
        
        if result.returncode == 0:
            logger.info("✓ Data extraction completed successfully")
            return True
        else:
            logger.error(f"✗ Data extraction failed with exit code {result.returncode}")
            return False
            
    except Exception as e:
        logger.error(f"✗ Data extraction failed: {e}")
        return False


def verify_data() -> bool:
    """
    Run verification script to check data quality.
    
    Returns:
        True if successful, False otherwise
    """
    logger.info("="*70)
    logger.info("VERIFYING: Data quality")
    logger.info("="*70)
    
    script_path = Path(__file__).parent / "verify_data.py"
    
    try:
        result = subprocess.run(
            [sys.executable, str(script_path)],
            capture_output=True,
            text=True,
            cwd=Path(__file__).parent.parent
        )
        
        # Log output
        if result.stdout:
            logger.info(result.stdout)
        
        return result.returncode == 0
            
    except Exception as e:
        logger.error(f"✗ Data verification failed: {e}")
        return False


def main():
    """Main entry point."""
    import argparse
    
    parser = argparse.ArgumentParser(
        description='Sync all mutual fund data',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Sync all funds (auto-detect latest month)
  python scripts/sync_all_funds.py
  
  # Sync last 3 months for all funds
  python scripts/sync_all_funds.py --months 3
  
  # Sync specific month
  python scripts/sync_all_funds.py --year 2026 --month 2
  
  # Force re-download even if exists
  python scripts/sync_all_funds.py --force
        """
    )
    
    parser.add_argument('--year', type=int, help='Target year (default: auto-detect)')
    parser.add_argument('--month', type=int, help='Target month 1-12 (default: auto-detect)')
    parser.add_argument('--months', type=int, help='Number of recent months to sync (default: 1)')
    parser.add_argument('--force', action='store_true', help='Force re-download even if exists')
    parser.add_argument('--skip-extraction', action='store_true', help='Skip extraction step')
    parser.add_argument('--skip-verification', action='store_true', help='Skip verification step')
    
    args = parser.parse_args()
    
    logger.info("╔" + "="*68 + "╗")
    logger.info("║" + " "*15 + "MUTUAL FUND DATA SYNC SCRIPT" + " "*25 + "║")
    logger.info("╚" + "="*68 + "╝")
    logger.info("")
    logger.info(f"Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    logger.info(f"Log file: {log_file}")
    logger.info("")
    
    # Determine months to sync
    if args.year and args.month:
        months_to_sync = [(args.year, args.month)]
    elif args.months:
        months_to_sync = get_recent_months(args.months)
    else:
        months_to_sync = get_recent_months(1)
    
    logger.info(f"Syncing {len(months_to_sync)} month(s):")
    for year, month in months_to_sync:
        month_name = datetime(year, month, 1).strftime('%B')
        logger.info(f"  - {month_name} {year}")
    logger.info("")
    
    # Track results
    canara_success = 0
    canara_failed = 0
    
    # Sync Canara Robeco for each month
    for year, month in months_to_sync:
        if sync_canara_robeco(year, month, args.force):
            canara_success += 1
        else:
            canara_failed += 1
        logger.info("")
    
    # Show Mirae Asset reminder
    sync_mirae_asset_manual_reminder()
    
    # Extract data (unless skipped)
    extraction_success = True
    if not args.skip_extraction:
        extraction_success = extract_all_data()
        logger.info("")
    
    # Verify data (unless skipped)
    verification_success = True
    if not args.skip_verification:
        verification_success = verify_data()
        logger.info("")
    
    # Summary
    logger.info("╔" + "="*68 + "╗")
    logger.info("║" + " "*25 + "SYNC SUMMARY" + " "*31 + "║")
    logger.info("╚" + "="*68 + "╝")
    logger.info("")
    logger.info(f"Canara Robeco:")
    logger.info(f"  ✓ Successful: {canara_success}")
    if canara_failed > 0:
        logger.info(f"  ⚠ Not available: {canara_failed} (file may not be published yet)")
    logger.info("")
    logger.info(f"Mirae Asset:")
    logger.info(f"  ⚠ Manual download required")
    logger.info("")
    logger.info(f"Data Extraction: {'✓ Success' if extraction_success else '✗ Failed'}")
    logger.info(f"Data Verification: {'✓ Success' if verification_success else '✗ Failed'}")
    logger.info("")
    logger.info(f"Completed at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    logger.info(f"Log saved to: {log_file}")
    logger.info("")
    
    # Exit code
    if not extraction_success:
        logger.error("⚠ Sync completed with errors (extraction failed)")
        sys.exit(1)
    elif canara_failed > 0:
        logger.warning("⚠ Sync completed - some files not yet available")
        logger.info("  Tip: Run again after the 5th of the month when files are published")
        sys.exit(0)  # Not an error, just not published yet
    else:
        logger.info("✓ Sync completed successfully")
        sys.exit(0)


if __name__ == "__main__":
    main()
