"""
Setup Windows Task Scheduler for Canara Robeco Auto-Download
Creates a scheduled task that runs on the 5th of each month
"""

import os
import sys
from pathlib import Path
import subprocess

TASK_NAME = "CanaraRobecoAutoDownload"
SCRIPT_PATH = Path(__file__).parent / "canara_auto_download.py"
PYTHON_PATH = sys.executable
PROJECT_ROOT = Path(__file__).parent.parent


def create_task_xml() -> str:
    """Generate Windows Task Scheduler XML configuration."""
    
    xml = f"""<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.2" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <RegistrationInfo>
    <Description>Automatically download Canara Robeco monthly portfolio on the 5th of each month</Description>
    <URI>\\{TASK_NAME}</URI>
  </RegistrationInfo>
  <Triggers>
    <CalendarTrigger>
      <StartBoundary>2026-02-05T06:00:00</StartBoundary>
      <Enabled>true</Enabled>
      <ScheduleByMonth>
        <DaysOfMonth>
          <Day>5</Day>
        </DaysOfMonth>
        <Months>
          <January />
          <February />
          <March />
          <April />
          <May />
          <June />
          <July />
          <August />
          <September />
          <October />
          <November />
          <December />
        </Months>
      </ScheduleByMonth>
    </CalendarTrigger>
  </Triggers>
  <Principals>
    <Principal id="Author">
      <LogonType>InteractiveToken</LogonType>
      <RunLevel>LeastPrivilege</RunLevel>
    </Principal>
  </Principals>
  <Settings>
    <MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>
    <DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>
    <StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>
    <AllowHardTerminate>true</AllowHardTerminate>
    <StartWhenAvailable>true</StartWhenAvailable>
    <RunOnlyIfNetworkAvailable>true</RunOnlyIfNetworkAvailable>
    <IdleSettings>
      <StopOnIdleEnd>false</StopOnIdleEnd>
      <RestartOnIdle>false</RestartOnIdle>
    </IdleSettings>
    <AllowStartOnDemand>true</AllowStartOnDemand>
    <Enabled>true</Enabled>
    <Hidden>false</Hidden>
    <RunOnlyIfIdle>false</RunOnlyIfIdle>
    <WakeToRun>false</WakeToRun>
    <ExecutionTimeLimit>PT1H</ExecutionTimeLimit>
    <Priority>7</Priority>
  </Settings>
  <Actions Context="Author">
    <Exec>
      <Command>{PYTHON_PATH}</Command>
      <Arguments>{SCRIPT_PATH}</Arguments>
      <WorkingDirectory>{PROJECT_ROOT}</WorkingDirectory>
    </Exec>
  </Actions>
</Task>"""
    
    return xml


def setup_windows_task():
    """Create Windows Task Scheduler task."""
    print("Setting up Windows Task Scheduler...")
    print(f"Task Name: {TASK_NAME}")
    print(f"Python: {PYTHON_PATH}")
    print(f"Script: {SCRIPT_PATH}")
    print(f"Schedule: 5th of each month at 6:00 AM")
    print()
    
    # Generate XML
    xml_content = create_task_xml()
    xml_file = PROJECT_ROOT / "task_config.xml"
    
    with open(xml_file, 'w', encoding='utf-16') as f:
        f.write(xml_content)
    
    print(f"Generated task XML: {xml_file}")
    
    # Delete existing task if present
    try:
        subprocess.run(
            ['schtasks', '/Delete', '/TN', TASK_NAME, '/F'],
            capture_output=True,
            check=False
        )
    except:
        pass
    
    # Create task
    try:
        result = subprocess.run(
            ['schtasks', '/Create', '/XML', str(xml_file), '/TN', TASK_NAME],
            capture_output=True,
            text=True,
            check=True
        )
        
        print("\n✓ Task created successfully!")
        print("\nTo manage the task:")
        print(f"  View:   schtasks /Query /TN {TASK_NAME} /V /FO LIST")
        print(f"  Run:    schtasks /Run /TN {TASK_NAME}")
        print(f"  Delete: schtasks /Delete /TN {TASK_NAME} /F")
        print("\nOr use Task Scheduler GUI: taskschd.msc")
        
        # Clean up XML file
        xml_file.unlink()
        
    except subprocess.CalledProcessError as e:
        print(f"\n✗ Failed to create task: {e}")
        print(f"Output: {e.output}")
        print(f"\nYou can manually import the task XML: {xml_file}")
        sys.exit(1)


def setup_python_scheduler():
    """Alternative: Use APScheduler for cross-platform scheduling."""
    print("\nAlternative: Python-based scheduler (APScheduler)")
    print("This runs as a background service and works on any platform.")
    print()
    
    scheduler_script = PROJECT_ROOT / "scripts" / "run_scheduler.py"
    
    code = '''"""
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
'''
    
    with open(scheduler_script, 'w') as f:
        f.write(code)
    
    print(f"Created: {scheduler_script}")
    print("\nTo use Python scheduler:")
    print("  1. Install: pip install apscheduler")
    print(f"  2. Run: python {scheduler_script}")
    print("  3. Keep it running in background or as a service")


def main():
    print("="*70)
    print("Canara Robeco Auto-Download Scheduler Setup")
    print("="*70)
    print()
    
    if sys.platform == 'win32':
        print("Detected Windows - Setting up Task Scheduler")
        setup_windows_task()
        print()
        setup_python_scheduler()
    else:
        print("Detected non-Windows platform")
        setup_python_scheduler()
        print("\nFor cron (Linux/Mac), add to crontab:")
        print(f"0 6 5 * * {PYTHON_PATH} {SCRIPT_PATH}")


if __name__ == "__main__":
    main()
