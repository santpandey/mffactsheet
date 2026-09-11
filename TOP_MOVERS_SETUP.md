# Top Movers Automation Setup Guide

This guide explains how to set up automated top movers notifications via Telegram, scheduled to run Monday-Friday at 5 PM IST.

## Prerequisites

- Python 3.9+ with virtual environment
- Telegram account
- Windows Task Scheduler access

## Step 1: Set Up Telegram Bot

### Create a Telegram Bot

1. Open Telegram and search for **@BotFather**
2. Send `/newbot` command
3. Follow the prompts to name your bot (e.g., "Top Movers Bot")
4. BotFather will give you a **bot token** (save this - you'll need it)

### Get Your Chat ID

1. Open Telegram and search for **@userinfobot**
2. Send `/start` command
3. It will reply with your **Chat ID** (save this - you'll need it)

### Test the Bot

1. Search for your bot by username in Telegram
2. Click **Start** to begin a conversation
3. Your bot can now send messages to you

## Step 2: Configure the Script

Edit `config/top_movers_config.json`:

```json
{
  "schedule": {
    "days": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
    "time": "17:00",
    "timezone": "Asia/Kolkata"
  },
  "telegram": {
    "bot_token": "YOUR_TELEGRAM_BOT_TOKEN",
    "chat_id": "YOUR_TELEGRAM_CHAT_ID"
  },
  "movers": {
    "universe": "NIFTY_MIDCAP_100",
    "top_n": 10,
    "include_daily": true,
    "include_weekly": true
  }
}
```

Replace:
- `YOUR_TELEGRAM_BOT_TOKEN` with the token from BotFather
- `YOUR_TELEGRAM_CHAT_ID` with your chat ID from @userinfobot

## Step 3: Install Dependencies

```powershell
cd d:\mffactsheet
.\venv\Scripts\activate
pip install requests
```

## Step 4: Test the Script

Run the script manually to test:

```powershell
.\venv\Scripts\python.exe scripts\auto_top_movers.py
```

Or use the batch file:

```powershell
scripts\run_top_movers.bat
```

You should see a message preview in the console (if not configured) or receive a Telegram message.

## Step 5: Set Up Windows Task Scheduler

### Method A: Using Task Scheduler GUI

1. Open **Task Scheduler** (search for "Task Scheduler" in Windows)
2. Click **Create Task** in the right panel
3. **General Tab**:
   - Name: `Top Movers Notifier`
   - Description: `Fetch and send top movers to Telegram at 5 PM IST`
   - Select: `Run whether user is logged on or not`
   - Check: `Run with highest privileges`
4. **Triggers Tab**:
   - Click **New**
   - Begin the task: `On a schedule`
   - Settings: `Daily`
   - Start: `5:00:00 PM`
   - Repeat every: `1 day`
   - Check: `Enabled`
5. **Actions Tab**:
   - Click **New**
   - Action: `Start a program`
   - Program/script: `d:\mffactsheet\scripts\run_top_movers.bat`
   - Start in: `d:\mffactsheet`
6. **Conditions Tab**:
   - Uncheck: `Start the task only if the computer is on AC power`
7. **Settings Tab**:
   - Check: `Allow task to be run on demand`
   - Check: `Run task as soon as possible after a scheduled start is missed`
8. Click **OK** to save

### Method B: Using PowerShell (Automated)

Run this PowerShell command as Administrator:

```powershell
$action = New-ScheduledTaskAction -Execute "d:\mffactsheet\scripts\run_top_movers.bat" -WorkingDirectory "d:\mffactsheet"
$trigger = New-ScheduledTaskTrigger -Daily -At 5:00PM
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable
Register-ScheduledTask -TaskName "Top Movers Notifier" -Action $action -Trigger $trigger -Settings $settings -RunLevel Highest
```

## Step 6: Verify the Schedule

1. In Task Scheduler, find your task "Top Movers Notifier"
2. Right-click → **Run** to test immediately
3. Check the **History** tab to see if it ran successfully
4. Wait for 5 PM IST to verify automatic execution

## Troubleshooting

### Script runs but no Telegram message

- Verify bot token and chat ID are correct
- Ensure you've started a conversation with your bot in Telegram
- Check the script output for error messages

### Task Scheduler doesn't run

- Ensure the task is **Enabled**
- Check the **History** tab for error details
- Verify the path to the batch file is correct
- Try running the batch file manually first

### "requests module not found"

```powershell
.\venv\Scripts\activate
pip install requests
```

### Time zone issues

- Task Scheduler uses local system time
- Ensure your Windows time zone is set to IST (UTC+5:30)
- Or adjust the schedule time accordingly

## WhatsApp Integration (Optional)

For WhatsApp notifications, you can use:

1. **Twilio API** (paid service)
2. **WhatsApp Business API** (requires business verification)
3. **CallMeBot** (free, limited)

Example for Twilio (requires account):

```python
from twilio.rest import Client

def send_whatsapp_message(message, from_number, to_number):
    client = Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
    client.messages.create(
        body=message,
        from_=f"whatsapp:{from_number}",
        to=f"whatsapp:{to_number}"
    )
```

## Customization

### Change Schedule Time

Edit `config/top_movers_config.json`:

```json
{
  "schedule": {
    "time": "18:00"  // 6 PM IST
  }
}
```

Then update Task Scheduler trigger accordingly.

### Change Number of Movers

Edit `config/top_movers_config.json`:

```json
{
  "movers": {
    "top_n": 5  // Show top 5 instead of 10
  }
}
```

### Disable Weekly Movers

Edit `config/top_movers_config.json`:

```json
{
  "movers": {
    "include_weekly": false
  }
}
```

## Security Notes

- Never commit `config/top_movers_config.json` to version control
- Add it to `.gitignore`:
  ```
  config/top_movers_config.json
  ```
- Keep your bot token and chat ID secure
