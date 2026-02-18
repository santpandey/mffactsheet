"""
Background scheduler service using APScheduler
Run this as a service or in the background
"""

from apscheduler.schedulers.blocking import BlockingScheduler
from apscheduler.triggers.cron import CronTrigger
import logging
import sys
from pathlib import Path

# Add scripts to path
sys.path.insert(0, str(Path(__file__).parent))

from canara_auto_download import download_monthly_portfolio, get_target_month

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def scheduled_download():
    """Job function called by scheduler."""
    logger.info("Scheduled download triggered")
    year, month = get_target_month()
    success = download_monthly_portfolio(year, month)
    
    if success:
        logger.info("Download completed successfully")
    else:
        logger.error("Download failed")


def main():
    scheduler = BlockingScheduler()
    
    # Run on 5th of each month at 6 AM
    trigger = CronTrigger(day=5, hour=6, minute=0)
    scheduler.add_job(scheduled_download, trigger, id='canara_download')
    
    logger.info("Scheduler started. Will run on 5th of each month at 6:00 AM")
    logger.info("Press Ctrl+C to exit")
    
    try:
        scheduler.start()
    except (KeyboardInterrupt, SystemExit):
        logger.info("Scheduler stopped")


if __name__ == "__main__":
    main()
