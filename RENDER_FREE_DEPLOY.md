# 🆓 FREE Render.com Deployment Guide

**Cost:** $0/month (completely FREE with free tier)

---

## ✅ Prerequisites

- [ ] GitHub account
- [ ] Code pushed to GitHub (`git push origin main`)
- [ ] MongoDB connection string ready
- [ ] Render.com account (sign up with GitHub)

---

## 🚀 Step-by-Step Deployment

### Step 1: Push Code to GitHub
```bash
cd c:\Users\bacha\bus-tracker

git add .
git commit -m "Ready for Render deployment"
git push origin main
```

### Step 2: Go to Render Dashboard
1. Visit: https://render.com
2. Sign up with GitHub (or login if already have account)
3. Click **"New +"** → **"Web Service"**

### Step 3: Connect GitHub Repository
1. Click **"Connect a repository"**
2. Search for **"bus-tracker"**
3. Click **"Connect"**

### Step 4: Configure Web Service

**Fill in these fields:**

```
Name: bus-tracker-app
Environment: Node
Build Command: cd backend && npm install
Start Command: cd backend && npm start
Root Directory: (leave blank)
```

### Step 5: Add Environment Variables

Click **"Advanced"** → **"Add Environment Variable"**

Add each variable one by one:

**1. MongoDB URI**
```
Key: MONGODB_URI
Value: mongodb+srv://user:password@cluster.mongodb.net/moveon
```
(Get from MongoDB Atlas)

**2. JWT Secret**
```
Key: JWT_SECRET
Value: (run: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
```

**3. Admin Password**
```
Key: ADMIN_PASSWORD
Value: YourStrongPassword123!
```

**4. Environment**
```
Key: NODE_ENV
Value: production
```

**5. Frontend URL**
```
Key: FRONTEND_URL
Value: https://your-render-url.onrender.com
```
(You'll get this URL after deployment)

### Step 6: Deploy
1. Scroll down
2. Click **"Create Web Service"**
3. Wait for build to complete (~3-5 minutes)

**Watch the deploy logs:**
- Look for ✅ "MongoDB connected"
- Look for ✅ "Server running on port"

### Step 7: Get Your URL
After deployment succeeds:
- Render gives you URL like: `https://bus-tracker-app.onrender.com`
- Update FRONTEND_URL environment variable to this URL
- Click **"Redeploy"**

### Step 8: Test
```bash
curl https://your-app-name.onrender.com/health
```

Should return:
```json
{"status":"ok","service":"MoveOn Go API","database":"connected"}
```

---

## 📱 Access Your App

**Frontend:** https://your-app-name.onrender.com  
**API:** https://your-app-name.onrender.com/api  
**Health:** https://your-app-name.onrender.com/health

---

## 🔄 Auto-Deploy Updates

Render automatically redeploys when you push to GitHub:

```bash
# Make changes
git add .
git commit -m "bug fix"
git push origin main

# Render auto-deploys in ~2 minutes
```

---

## 💡 Free Tier Limitations

- **Spins down after 15 min of inactivity** (wakes up when requested)
- **Limited to 0.5 CPU cores** (fine for testing)
- **512MB RAM** (enough for your app)
- **Shared bandwidth** (good for small traffic)

*Free tier is perfect for testing before going paid!*

---

## 📈 Upgrade When Ready

If you need:
- Always-on service (no spin-down)
- More CPU/RAM
- 24/7 monitoring

Upgrade to paid plan ($12/month or more).

---

## 🆘 Troubleshooting

### Deployment fails
```
Check logs: Render dashboard → Logs tab
```

### MongoDB connection error
```
Verify MONGODB_URI is correct
Check MongoDB Atlas whitelist includes Render IP
```

### Frontend not loading
```
Update FRONTEND_URL to your Render URL
Redeploy
```

### App keeps spinning down
```
Free tier spins down after 15 min inactivity
This is normal - it'll wake up when you access it
```

---

## ✅ You're Done!

Your bus tracker is live on FREE tier! 🎉

**Your URLs:**
- App: https://your-app-name.onrender.com
- API: https://your-app-name.onrender.com/api

---

**Questions?** See full guide or check Render docs: https://docs.render.com
