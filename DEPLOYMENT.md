# Deployment Guide - Netlify

## 🌐 Deployment Architecture

### **Static Frontend Only (Recommended for Free Tier)**

Since Netlify free tier only supports static sites, we'll deploy the **frontend only** with pre-generated JSON data.

```
┌─────────────────────────────────────────────┐
│           Netlify (Free Tier)               │
│                                             │
│  ┌─────────────────────────────────────┐   │
│  │  Static Files:                      │   │
│  │  - index.html                       │   │
│  │  - css/styles.css                   │   │
│  │  - js/app-multi-fund.js             │   │
│  │  - data/*.json (pre-generated)      │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  ❌ Sync Button (disabled on production)   │
│  ❌ Python scripts (not deployed)          │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│      Local Machine (for updates)            │
│                                             │
│  1. Download new data manually              │
│  2. Run: python scripts/extract_all_funds.py│
│  3. Commit updated JSON files               │
│  4. Push to Git → Auto-deploy to Netlify   │
└─────────────────────────────────────────────┘
```

---

## 📋 Pre-Deployment Checklist

### **1. Clean Up Repository**

```powershell
# Remove files not needed for deployment
Remove-Item -Recurse -Force venv/
Remove-Item -Recurse -Force logs/
Remove-Item -Recurse -Force excel-data/  # Too large, not needed
Remove-Item start_server.bat
```

### **2. Disable Sync Button for Production**

The sync button won't work on Netlify (no Python backend). We'll hide it in production.

**Edit `js/app-multi-fund.js`:**

Add this at the top of the `init()` function:

```javascript
async function init() {
  const loading = document.getElementById("loadingOverlay");
  
  // Hide sync button in production (Netlify)
  const syncBtn = document.getElementById("syncBtn");
  if (syncBtn && window.location.hostname !== 'localhost') {
    syncBtn.style.display = 'none';
  }
  
  // ... rest of init code
}
```

### **3. Ensure Data Files are Committed**

```powershell
# Make sure all JSON files are in git
git add data/*.json
git commit -m "Add latest fund data for deployment"
```

---

## 🚀 Deployment Steps

### **Option 1: Deploy via Netlify UI (Easiest)**

1. **Push to GitHub/GitLab**
   ```powershell
   git add .
   git commit -m "Prepare for Netlify deployment"
   git push origin main
   ```

2. **Connect to Netlify**
   - Go to https://app.netlify.com
   - Click "Add new site" → "Import an existing project"
   - Choose GitHub/GitLab
   - Select your repository

3. **Configure Build Settings**
   - **Build command**: Leave empty (no build needed)
   - **Publish directory**: `.` (root directory)
   - Click "Deploy site"

4. **Done!** Your site will be live at `https://random-name.netlify.app`

### **Option 2: Deploy via Netlify CLI**

```powershell
# Install Netlify CLI
npm install -g netlify-cli

# Login to Netlify
netlify login

# Deploy from project root
cd d:\mffactsheet
netlify deploy --prod

# Follow prompts:
# - Create new site or link existing
# - Publish directory: . (current directory)
```

---

## 🔧 Configuration Files

### **netlify.toml** (Already Created)

This file configures:
- ✅ Publish directory
- ✅ Security headers
- ✅ Cache control for JSON/CSS/JS
- ✅ SPA routing (if needed)

### **.gitignore** (Updated)

Excludes:
- ❌ Python virtual environment
- ❌ Excel source files (too large)
- ❌ Logs
- ❌ Local scripts
- ✅ Includes JSON data files

---

## 📊 What Gets Deployed

### **Included:**
- ✅ `index.html`
- ✅ `css/styles.css`
- ✅ `js/app-multi-fund.js`
- ✅ `data/*.json` (all fund data)
- ✅ `README.md` and documentation
- ✅ `netlify.toml` (configuration)

### **Excluded:**
- ❌ `venv/` (Python environment)
- ❌ `scripts/` (Python scripts)
- ❌ `excel-data/` (source files)
- ❌ `logs/` (log files)
- ❌ `start_server.bat` (local dev script)

---

## 🔄 Updating Data on Production

Since Python scripts won't run on Netlify, you'll update data locally and redeploy:

### **Monthly Update Workflow:**

1. **Download Latest Data (Local)**
   ```powershell
   # Canara Robeco (automatic)
   .\venv\Scripts\python.exe scripts\sync_all_funds.py
   
   # Mirae Asset (manual download from website)
   # Save to excel-data/mirae-asset/
   ```

2. **Extract to JSON (Local)**
   ```powershell
   .\venv\Scripts\python.exe scripts\extract_all_funds.py
   ```

3. **Commit and Push**
   ```powershell
   git add data/*.json
   git commit -m "Update fund data for [Month Year]"
   git push origin main
   ```

4. **Auto-Deploy**
   - Netlify automatically detects the push
   - Rebuilds and deploys in ~30 seconds
   - New data is live!

---

## 🎨 Production Optimizations

### **1. Hide Sync Button**

Already configured - sync button hidden when not on localhost.

### **2. Update README for Production**

Add a note that sync button is only for local development:

```markdown
**Note**: The sync button is only available in local development. 
For production updates, see DEPLOYMENT.md.
```

### **3. Add Update Timestamp**

Show when data was last updated:

**Edit `index.html`:**
```html
<p class="subtitle">
  Last updated: February 2026 | Data from fund factsheets
</p>
```

---

## 🔐 Security Considerations

### **Already Configured:**
- ✅ Security headers (X-Frame-Options, CSP, etc.)
- ✅ HTTPS (automatic on Netlify)
- ✅ No sensitive data exposed
- ✅ No backend/API keys needed

### **Data Privacy:**
- ✅ All data is from public fund factsheets
- ✅ No user data collected
- ✅ No authentication required

---

## 💰 Cost Analysis

### **Netlify Free Tier:**
- ✅ 100 GB bandwidth/month (plenty for this app)
- ✅ 300 build minutes/month (we use ~1 min/deploy)
- ✅ Unlimited sites
- ✅ HTTPS included
- ✅ Custom domain support

### **Estimated Usage:**
- **Site size**: ~500 KB (HTML + CSS + JS + JSON)
- **Monthly visitors**: 100 → ~50 MB bandwidth
- **Deploys**: 1-2 per month → ~2 build minutes
- **Cost**: $0 (well within free tier) ✅

---

## 🚨 Limitations on Netlify

### **What Won't Work:**

1. **❌ Sync Button**
   - No Python backend to run scripts
   - Solution: Hide button, update data locally

2. **❌ Auto-Download**
   - Can't run Python scripts on Netlify
   - Solution: Manual local updates + git push

3. **❌ Real-time Data**
   - Data is static JSON files
   - Solution: Monthly manual updates (acceptable for fund data)

### **What Works Perfectly:**

1. **✅ All Visualizations**
   - Charts, graphs, tables
   - Month comparison
   - Historical trends

2. **✅ All Interactivity**
   - Fund switching
   - Search and filters
   - Sorting

3. **✅ Fast Performance**
   - Static files load instantly
   - No server processing needed

---

## 🎯 Alternative: Full-Stack Deployment

If you want the sync button to work in production, you'd need:

### **Option A: Netlify + Serverless Functions**
- ❌ Requires Netlify Pro ($19/month)
- ❌ Limited Python support
- ❌ Complex setup

### **Option B: Frontend (Netlify) + Backend (Heroku/Railway)**
- Frontend: Netlify (free)
- Backend: Heroku/Railway (free tier available)
- ⚠️ More complex architecture
- ⚠️ Two deployments to manage

### **Recommendation:**
**Stick with static deployment** - fund data updates monthly, so manual updates are fine.

---

## 📝 Post-Deployment Checklist

After deploying to Netlify:

- [ ] Test all fund data loads correctly
- [ ] Verify charts render properly
- [ ] Check month comparison works
- [ ] Confirm search/filter functionality
- [ ] Test on mobile devices
- [ ] Verify custom domain (if configured)
- [ ] Check HTTPS is working
- [ ] Test performance (should be fast!)

---

## 🔗 Custom Domain (Optional)

### **Add Custom Domain:**

1. Go to Netlify dashboard → Site settings → Domain management
2. Click "Add custom domain"
3. Enter your domain (e.g., `myfunds.example.com`)
4. Update DNS records at your domain registrar:
   ```
   Type: CNAME
   Name: myfunds (or @)
   Value: your-site.netlify.app
   ```
5. Wait for DNS propagation (~1 hour)
6. Netlify automatically provisions SSL certificate

---

## 📞 Support

**Netlify Issues:**
- Docs: https://docs.netlify.com
- Community: https://answers.netlify.com

**Deployment Questions:**
- Check build logs in Netlify dashboard
- Verify all files are committed to git
- Ensure `netlify.toml` is in repository root

---

## ✅ Quick Deploy Checklist

```powershell
# 1. Clean up
Remove-Item -Recurse -Force venv/, logs/, excel-data/

# 2. Ensure data is current
.\venv\Scripts\python.exe scripts\extract_all_funds.py

# 3. Commit everything
git add .
git commit -m "Deploy to Netlify"
git push origin main

# 4. Deploy via Netlify UI or CLI
netlify deploy --prod
```

**Your site will be live in ~1 minute!** 🚀
