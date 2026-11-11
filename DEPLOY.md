# Deploy Stock Agents API to Your Website

## Quick Start (Local Only — no deploy needed)
```bash
cd C:/Users/Cisco/stock_agents
npm install
node server.js          # starts at http://localhost:8766
```
Then open your site's admin page → "Stock Agents" tab.

---

## Option 1: Render.com (Free Tier — Recommended)

### Step 1: Push code to GitHub
```bash
cd C:/Users/Cisco/stock_agents
git init
git add .
git commit -m "Initial stock agents API"
# Then create a new repo at github.com and push
git remote add origin https://github.com/YOUR_USERNAME/stock-agents.git
git branch -M main
git push -u origin main
```

### Step 2: Deploy on Render
1. Go to [render.com](https://render.com) → Sign up (free)
2. Click **New +** → **Web Service**
3. Connect your GitHub repo (select `stock-agents`)
4. Settings:
   - Name: `stock-agents`
   - Environment: `Node`
   - Root Directory: `/stock-agents` (if nested) or leave blank
   - Build Command: `npm install`
   - Start Command: `node server.js`
5. Click **Create Web Service**
6. Wait ~2 minutes. You'll get a URL like `https://stock-agents-xxxx.onrender.com`

### Step 3: Update admin.html to point to your deployed URL
Open [C:/Users/Cisco/Downloads/Vench/admin.html](file:///C:/Users/Cisco/Downloads/Vench/admin.html), find line with:
```javascript
fetch("http://localhost:8766/api/analyze", {
```
Change to:
```javascript
fetch("https://stock-agents-xxxx.onrender.com/api/analyze", {
```

---

## Option 2: Keep Local + Expose via ngrok (Free, No Deploy Needed)

If you don't want to push code anywhere:

1. Install ngrok: https://ngrok.com/download
2. Run:
   ```bash
   cd C:/Users/Cisco/stock_agents
   npm install express        # if not done
   node server.js             # start API on port 8766
   ```
3. In another terminal:
   ```bash
   ngrok http 8766
   ```
4. Copy the HTTPS URL shown (like `https://abc123.ngrok.io`)
5. Update admin.html same as above — replace localhost URL with ngrok URL
6. When you restart ngrok, the URL changes — just update admin.html again

---

## Option 3: Vercel (Free, Simplest)

1. Push to GitHub (same steps as Option 1)
2. Go to [vercel.com](https://vercel.com) → Import project
3. Select `stock-agents` repo
4. Framework Preset: `Other`
5. Root Directory: `stock_agents` (or `/` if at root)
6. Deploy

Vercel will give you a URL. Update admin.html with it.

---

## Notes
- The API runs on any Node.js host
- Free tiers may spin down after inactivity (~1 min cold start on next request)
- Yahoo Finance rate limits: ~50 req/min — our cache handles repeated requests
- All data comes from Yahoo Finance + Google News RSS (no API key needed)
