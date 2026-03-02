"""
Unified Sync Script for All Mutual Funds
Auto-discovers all fund downloaders in scripts/downloaders/ and runs them.

Usage:
    python scripts/sync_all_funds.py                        # Sync all funds (previous month)
    python scripts/sync_all_funds.py --months 3             # Sync last 3 months
    python scripts/sync_all_funds.py --year 2026 --month 2  # Sync specific month
    python scripts/sync_all_funds.py --fund canara_robeco   # Sync a single fund
    python scripts/sync_all_funds.py --force                # Force re-download
    python scripts/sync_all_funds.py --list                 # List all registered funds
"""

import sys
import importlib
import inspect
import logging
import subprocess
from pathlib import Path
from datetime import datetime, timedelta
from typing import List, Tuple, Dict

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


def get_recent_months(count: int = 1) -> List[Tuple[int, int]]:
    """Return list of (year, month) for the last `count` months."""
    months = []
    current = datetime.now()
    for i in range(count):
        target = current - timedelta(days=30 * i)
        months.append((target.year, target.month))
    return months


def discover_downloaders() -> Dict[str, object]:
    """
    Auto-discover all BaseFundDownloader subclasses in scripts/downloaders/.
    Returns a dict of {fund_key: downloader_instance}.
    """
    from downloaders.base_downloader import BaseFundDownloader

    downloaders_dir = Path(__file__).parent / "downloaders"
    discovered: Dict[str, object] = {}

    for py_file in sorted(downloaders_dir.glob("*.py")):
        if py_file.name.startswith("_") or py_file.name == "base_downloader.py":
            continue
        module_name = f"downloaders.{py_file.stem}"
        try:
            module = importlib.import_module(module_name)
            for _, cls in inspect.getmembers(module, inspect.isclass):
                if (
                    issubclass(cls, BaseFundDownloader)
                    and cls is not BaseFundDownloader
                    and cls.FUND_KEY
                ):
                    instance = cls()
                    discovered[cls.FUND_KEY] = instance
                    logger.debug(f"  Registered: {cls.FUND_KEY} -> {cls.__name__}")
        except Exception as e:
            logger.warning(f"  Could not load {module_name}: {e}")

    return discovered


def extract_all_data() -> bool:
    """Run extract_all_funds.py to process all downloaded Excel files."""
    logger.info("=" * 70)
    logger.info("EXTRACTING: All fund data to JSON")
    logger.info("=" * 70)
    script_path = Path(__file__).parent / "extract_all_funds.py"
    try:
        result = subprocess.run(
            [sys.executable, str(script_path)],
            capture_output=True,
            text=True,
            cwd=Path(__file__).parent.parent,
        )
        if result.stdout:
            for line in result.stdout.split("\n"):
                if line.strip():
                    logger.info(f"  [Extract] {line}")
        if result.returncode == 0:
            logger.info("OK: Data extraction completed")
            return True
        else:
            logger.error(f"FAILED: Data extraction exit code {result.returncode}")
            if result.stderr:
                logger.error(result.stderr[:500])
            return False
    except Exception as e:
        logger.error(f"FAILED: Data extraction error: {e}")
        return False


def verify_data() -> bool:
    """Run verify_data.py to check data quality."""
    logger.info("=" * 70)
    logger.info("VERIFYING: Data quality")
    logger.info("=" * 70)
    script_path = Path(__file__).parent / "verify_data.py"
    try:
        result = subprocess.run(
            [sys.executable, str(script_path)],
            capture_output=True,
            text=True,
            cwd=Path(__file__).parent.parent,
        )
        if result.stdout:
            logger.info(result.stdout)
        return result.returncode == 0
    except Exception as e:
        logger.error(f"FAILED: Verification error: {e}")
        return False


def main():
    """Main entry point."""
    import argparse

    parser = argparse.ArgumentParser(
        description="Sync all mutual fund data",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python scripts/sync_all_funds.py                        # Sync all funds (previous month)
  python scripts/sync_all_funds.py --months 3             # Sync last 3 months
  python scripts/sync_all_funds.py --year 2026 --month 2  # Sync specific month
  python scripts/sync_all_funds.py --fund canara_robeco   # Sync one fund only
  python scripts/sync_all_funds.py --list                 # List all registered funds
  python scripts/sync_all_funds.py --force                # Force re-download
        """,
    )
    parser.add_argument("--year", type=int, help="Target year")
    parser.add_argument("--month", type=int, help="Target month 1-12")
    parser.add_argument("--months", type=int, default=1, help="Number of recent months (default: 1)")
    parser.add_argument("--fund", type=str, help="Sync a single fund by FUND_KEY")
    parser.add_argument("--force", action="store_true", help="Force re-download even if file exists")
    parser.add_argument("--skip-extraction", action="store_true", help="Skip extraction step")
    parser.add_argument("--skip-verification", action="store_true", help="Skip verification step")
    parser.add_argument("--list", action="store_true", help="List all registered fund downloaders")

    args = parser.parse_args()

    logger.info("=" * 70)
    logger.info("  MUTUAL FUND DATA SYNC")
    logger.info("=" * 70)
    logger.info(f"Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    logger.info(f"Log: {log_file}")
    logger.info("")

    # Add scripts/ to sys.path so relative imports work when called directly
    scripts_dir = str(Path(__file__).parent)
    if scripts_dir not in sys.path:
        sys.path.insert(0, scripts_dir)

    # Discover all fund downloaders
    all_downloaders = discover_downloaders()

    if args.list:
        logger.info(f"Registered fund downloaders ({len(all_downloaders)}):")
        for key, dl in sorted(all_downloaders.items()):
            logger.info(f"  {key:25s} -> {dl.FUND_DISPLAY_NAME}")
        return

    # Filter to single fund if requested
    if args.fund:
        if args.fund not in all_downloaders:
            logger.error(f"Unknown fund key: '{args.fund}'. Use --list to see available funds.")
            sys.exit(1)
        downloaders_to_run = {args.fund: all_downloaders[args.fund]}
    else:
        downloaders_to_run = all_downloaders

    logger.info(f"Funds to sync: {len(downloaders_to_run)}")
    for key, dl in downloaders_to_run.items():
        logger.info(f"  - {dl.FUND_DISPLAY_NAME}")
    logger.info("")

    # Determine months to sync
    if args.year and args.month:
        months_to_sync = [(args.year, args.month)]
    else:
        months_to_sync = get_recent_months(args.months)

    logger.info(f"Months to sync: {len(months_to_sync)}")
    for y, m in months_to_sync:
        logger.info(f"  - {datetime(y, m, 1).strftime('%B %Y')}")
    logger.info("")

    # Run each downloader for each month
    results: Dict[str, Dict] = {}
    for fund_key, downloader in downloaders_to_run.items():
        results[fund_key] = {"success": 0, "failed": 0, "skipped": 0}
        for year, month in months_to_sync:
            logger.info("-" * 70)
            try:
                ok = downloader.download(year, month, force=args.force)
                if ok:
                    results[fund_key]["success"] += 1
                else:
                    results[fund_key]["failed"] += 1
            except Exception as e:
                logger.error(f"Unexpected error for {fund_key}: {e}")
                results[fund_key]["failed"] += 1
        logger.info("")

    # Extraction
    extraction_ok = True
    if not args.skip_extraction:
        extraction_ok = extract_all_data()
        
        # Generate manifest file for frontend after extraction
        if extraction_ok:
            logger.info("=" * 70)
            logger.info("GENERATING: JSON Manifest for UI")
            logger.info("=" * 70)
            manifest_script = Path(__file__).parent / "generate_manifest.py"
            try:
                manifest_result = subprocess.run(
                    [sys.executable, str(manifest_script)],
                    capture_output=True,
                    text=True,
                    cwd=Path(__file__).parent.parent
                )
                if manifest_result.returncode == 0:
                    logger.info("OK: Manifest generation completed")
                else:
                    logger.error(
                        f"FAILED: Manifest generation exit code {manifest_result.returncode}"
                    )
                    if manifest_result.stderr:
                        logger.error(manifest_result.stderr[:500])
            except Exception as e:
                logger.error(f"FAILED: Manifest generation error: {e}")
                
        logger.info("")

    # Verification
    verification_ok = True
    if not args.skip_verification:
        verification_ok = verify_data()
        logger.info("")

    # Summary
    logger.info("=" * 70)
    logger.info("  SYNC SUMMARY")
    logger.info("=" * 70)
    total_success = 0
    total_failed = 0
    for fund_key, res in results.items():
        dl = downloaders_to_run[fund_key]
        status = "OK" if res["failed"] == 0 else "PARTIAL" if res["success"] > 0 else "FAILED"
        logger.info(
            f"  [{status:7s}] {dl.FUND_DISPLAY_NAME}: "
            f"{res['success']} ok, {res['failed']} failed"
        )
        total_success += res["success"]
        total_failed += res["failed"]

    logger.info("")
    logger.info(f"  Total: {total_success} succeeded, {total_failed} failed")
    logger.info(f"  Extraction:  {'OK' if extraction_ok else 'FAILED'}")
    logger.info(f"  Verification: {'OK' if verification_ok else 'FAILED'}")
    logger.info(f"  Completed: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    logger.info("=" * 70)

    if not extraction_ok:
        sys.exit(1)
    elif total_failed > 0 and total_success == 0:
        logger.warning("All downloads failed — files may not be published yet")
        sys.exit(0)
    else:
        sys.exit(0)


if __name__ == "__main__":
    main()
