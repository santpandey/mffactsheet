# Sync Button Feature

## 🔄 Overview

The sync button allows you to update fund data directly from the UI without running scripts manually.

## 🚀 Quick Start

### **Option 1: Use Startup Script (Recommended)**

```powershell
# Start both servers with one command
.\start_server.bat
```

This will:
1. Start Sync API Server on port 8001
2. Start Web Server on port 8000
3. Open browser to http://localhost:8000

### **Option 2: Manual Start**

```powershell
# Terminal 1: Start Sync API Server
uv run python scripts\sync_server.py

# Terminal 2: Start Web Server
uv run python-m http.server 8000
```

## 📊 How It Works

### **Architecture**

```
┌─────────────┐      HTTP POST      ┌──────────────┐
│   Browser   │ ─────────────────> │  Sync API    │
│   (UI)      │                     │  Server      │
│             │ <───────────────── │  (Port 8001) │
└─────────────┘      JSON Response  └──────────────┘
                                           │
                                           │ Executes
                                           ▼
                                    ┌──────────────┐
                                    │ sync_all_    │
                                    │ funds.py     │
                                    └──────────────┘
                                           │
                                           │ Downloads
                                           ▼
                                    ┌──────────────┐
                                    │ Excel Files  │
                                    │ + Extraction │
                                    └──────────────┘
                                           │
                                           │ Updates
                                           ▼
                                    ┌──────────────┐
                                    │ JSON Files   │
                                    │ (data/)      │
                                    └──────────────┘
```

### **Sync Flow**

1. **User clicks "🔄 Sync Data" button**
2. **UI sends POST request** to `http://localhost:8001/api/sync`
3. **Sync API executes** `scripts/sync_all_funds.py`
4. **Script downloads** latest Canara Robeco data
5. **Script extracts** all Excel files to JSON
6. **API returns** success/failure response
7. **UI reloads** data and refreshes charts

## 🎯 Features

### **Button States**

| State | Appearance | Description |
|-------|------------|-------------|
| **Ready** | 🔄 Sync Data (Green) | Ready to sync |
| **Syncing** | 🔄 Syncing... (Orange) | Sync in progress |
| **Success** | ✓ Synced! (Green) | Sync completed |
| **Failed** | ✗ Sync Failed (Red) | Sync error |

### **What Gets Synced**

✅ **Canara Robeco**: Automatically downloaded
⚠️ **Mirae Asset**: Manual download still required (see MIRAE_ASSET_DOWNLOAD_GUIDE.md)

### **Auto-Refresh**

After successful sync:
- ✅ Reloads all JSON data
- ✅ Updates fund selector
- ✅ Updates month dropdowns
- ✅ Displays latest month
- ✅ Refreshes all charts
- ✅ No page reload needed!

## 🔧 Configuration

### **Sync API Server**

**Default Port**: 8001

**Change Port**:
```powershell
uv run python scripts\sync_server.py --port 8002
```

**Update UI** (if you change port):
Edit `js/app-multi-fund.js`:
```javascript
const response = await fetch("http://localhost:8002/api/sync", {
```

### **Timeout**

**Default**: 5 minutes (300 seconds)

**Change** in `scripts/sync_server.py`:
```python
timeout=600  # 10 minutes
```

## 🐛 Troubleshooting

### **"Sync Failed" Error**

**Cause**: Sync API server not running

**Solution**:
```powershell
# Start sync server
uv run python scripts\sync_server.py
```

### **CORS Errors**

**Cause**: Browser blocking cross-origin requests

**Solution**: Sync server already includes CORS headers. If issues persist, ensure both servers are running on localhost.

### **Timeout Errors**

**Cause**: Sync taking longer than 5 minutes

**Solution**: Increase timeout in `sync_server.py` or run sync manually:
```powershell
uv run python scripts\sync_all_funds.py
```

### **Port Already in Use**

**Error**: `Address already in use`

**Solution**:
```powershell
# Find process using port 8001
netstat -ano | findstr :8001

# Kill process (replace PID)
taskkill /PID <PID> /F

# Or use different port
uv run python scripts\sync_server.py --port 8002
```

## 📝 API Reference

### **POST /api/sync**

Triggers sync_all_funds.py script

**Request**:
```http
POST /api/sync HTTP/1.1
Host: localhost:8001
Content-Type: application/json
```

**Response** (Success):
```json
{
  "success": true,
  "message": "Sync completed successfully",
  "stdout": "... last 1000 chars of output ...",
  "stderr": ""
}
```

**Response** (Failure):
```json
{
  "success": false,
  "message": "Sync completed with warnings",
  "stdout": "...",
  "stderr": "... error details ..."
}
```

## 🔒 Security Notes

- **Local Only**: Server only accepts connections from localhost
- **No Authentication**: Suitable for local development only
- **Not for Production**: Do not expose to internet

## 🎓 Advanced Usage

### **Custom Sync Script**

Modify `sync_server.py` to run different scripts:

```python
sync_script = project_root / "scripts" / "my_custom_sync.py"
```

### **Sync Logs**

Check sync logs:
```powershell
# Sync script logs
type logs\sync_all_funds_*.log

# API server logs (console output)
```

### **Background Sync**

For scheduled syncs, use Windows Task Scheduler instead of the button:
```powershell
uv run python scripts\setup_scheduler.py
```

## 📚 Related Documentation

- **[README.md](README.md)**: Main project documentation
- **[SYNC_GUIDE.md](SYNC_GUIDE.md)**: Sync script usage
- **[WORKFLOW_GUIDE.md](WORKFLOW_GUIDE.md)**: Complete workflow
- **[MIRAE_ASSET_DOWNLOAD_GUIDE.md](MIRAE_ASSET_DOWNLOAD_GUIDE.md)**: Mirae Asset manual download

## ✅ Benefits

1. **No Terminal Needed**: Sync from browser
2. **Real-time Updates**: See new data immediately
3. **Visual Feedback**: Clear button states
4. **Error Handling**: Helpful error messages
5. **Auto-Refresh**: No page reload required

## 🚦 Status Indicators

Watch the button for sync status:
- 🟢 **Green**: Ready or completed
- 🟠 **Orange**: Syncing in progress
- 🔴 **Red**: Error occurred

---

**Happy Syncing!** 🎉
