# 🚀 Vercel + Render FREE Deployment Guide

**Total Cost: $0/month (Completely FREE Forever!)**

---

## 🏗️ Architecture

```
User Browser
    ↓
Vercel (Frontend - Always On ⚡)
    ├─ React App
    ├─ Vite Build
    └─ CDN Global
    
Vercel makes API calls to:
    ↓
Render (Backend - Free Tier 🎉)
    ├─ Node.js Server
    ├─ Socket.io
    ├─ MongoDB
    └─ May spin down after 15 min
```

---

## 📋 Prerequisites

- ✅ GitHub repo pushed (`sourabthebillionaire-collab/moveon-go`)
- ✅ MongoDB Atlas connection string ready
- ✅ Vercel account (free, no credit card)
- ✅ Render account (free, no credit card)

---

## 🎯 Step 1: Deploy BACKEND to Render

### 1.1 Go to Render
- Visit: **https://render.com**
- Sign up with GitHub

### 1.2 Create Web Service
1. Click **"New +"** → **"Web Service"**
2. Select your **"moveon-go"** repository
3. Configure:

```
Name: bus-tracker-backend
Environment: Node
Build Command: cd backend && npm install
Start Command: cd backend && npm start
Root Directory: (leave blank)
```

### 1.3 Add Environment Variables

Click **"Advanced"** → Add these variables:

```
Key: MONGODB_URI
Value: mongodb+srv://user:password@cluster.mongodb.net/moveon

Key: JWT_SECRET  
Value: (generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")

Key: ADMIN_PASSWORD
Value: YourStrongPassword123!

Key: NODE_ENV
Value: production

Key: FRONTEND_URL
Value: https://your-frontend-name.vercel.app
(You'll update this after Vercel deployment)
```

### 1.4 Deploy
- Click **"Create Web Service"**
- Wait 3-5 minutes for build
- ✅ You'll get URL like: `https://bus-tracker-backend.onrender.com`

---

## 🎯 Step 2: Deploy FRONTEND to Vercel

### 2.1 Go to Vercel
- Visit: **https://vercel.com**
- Sign up with GitHub (if not already)

### 2.2 Import Project
1. Click **"New Project"**
2. Select **"Import Git Repository"**
3. Search for **"moveon-go"** repo
4. Click **"Import"**

### 2.3 Configure Build
```
Framework: Vite (auto-detected)
Root Directory: frontend
Build Command: npm run build
Output Directory: dist
```

### 2.4 Add Environment Variables

Before deploying, add:

```
Name: VITE_API_URL
Value: https://bus-tracker-backend.onrender.com/api

Name: VITE_SOCKET_URL
Value: https://bus-tracker-backend.onrender.com
```

*(Replace "bus-tracker-backend" with your actual Render app name)*

### 2.5 Deploy
- Click **"Deploy"**
- Wait 2-3 minutes
- ✅ You'll get URL like: `https://moveon-go.vercel.app`

---

## 🔄 Step 3: Update Backend URL

Now update the backend with your Vercel frontend URL:

### 3.1 Go to Render Dashboard
1. Click on your **"bus-tracker-backend"** service
2. Go to **"Environment"**
3. Update:

```
FRONTEND_URL: https://moveon-go.vercel.app
```

### 3.2 Redeploy
- Click **"Manual Deploy"** → **"Deploy latest commit"**
- Wait ~2 minutes for redeploy

---

## ✅ Your Live App URLs

After both deployments:

```
Frontend:        https://moveon-go.vercel.app
Backend API:     https://bus-tracker-backend.onrender.com/api
Backend Health:  https://bus-tracker-backend.onrender.com/health
Socket.io:       https://bus-tracker-backend.onrender.com
```

---

## 🧪 Testing

### Test 1: Frontend Loads
```bash
curl https://moveon-go.vercel.app
```
Should show HTML of your React app

### Test 2: Backend Health
```bash
curl https://bus-tracker-backend.onrender.com/health
```
Should return:
```json
{"status":"ok","database":"connected"}
```

### Test 3: API Works
```bash
curl -X POST https://bus-tracker-backend.onrender.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"phone":"9876543210"}'
```

### Test 4: Open in Browser
```
https://moveon-go.vercel.app
```
- Enter phone number
- Login
- Try booking a ride
- Check live map

---

## 📊 Vercel Advantages

✅ **Always-On** (no spin-down)  
✅ **Global CDN** (fast worldwide)  
✅ **Lifetime Free** (no credit card)  
✅ **Auto-deploys** (push to GitHub = auto-deploy)  
✅ **Custom Domains** (add your domain later)

---

## 📊 Render Advantages

✅ **Free Tier** (no credit card)  
✅ **Full Backend** (Node.js)  
✅ **Socket.io** (real-time works perfectly)  
✅ **MongoDB** (easy connection)  
✅ **Auto-deploys** (push to GitHub = auto-deploy)

---

## 🔄 Auto-Deploy Both

After deployment, whenever you push to GitHub:

```bash
# Make changes
git add .
git commit -m "bug fix"
git push origin main

# Result:
# - Vercel auto-deploys frontend (~1 min)
# - Render auto-deploys backend (~3 min)
```

No manual steps needed!

---

## 💡 Production Checklist

- [ ] Vercel frontend deployed
- [ ] Render backend deployed
- [ ] Environment variables set correctly
- [ ] Health endpoint returns database: connected
- [ ] Frontend loads without errors
- [ ] Socket.io connects successfully
- [ ] Login works
- [ ] Booking works
- [ ] Live map loads

---

## 🆘 Troubleshooting

### Frontend shows API errors
```
Check:
1. VITE_API_URL is correct in Vercel
2. Backend health endpoint works
3. Backend CORS allows Vercel domain
```

### Socket.io not connecting
```
Check:
1. VITE_SOCKET_URL correct in Vercel
2. Backend Socket.io initialized
3. No CORS issues
```

### Backend spinning down (normal)
```
Free tier Render spins down after 15 min inactivity
This is expected behavior
App wakes up when accessed (adds ~3 sec delay)
```

### MongoDB connection error
```
Verify:
1. MONGODB_URI is correct
2. Credentials match Atlas
3. Render IP whitelisted in Atlas
```

---

## 📈 Upgrade Path (Optional, Later)

When ready for paid:

**Vercel Paid:** $20/month
- Custom domain
- 100GB bandwidth
- API rate limits removed

**Render Paid:** $12/month
- Always-on backend
- 2GB RAM
- More CPU cores

**Total:** ~$30-40/month for production-grade hosting

---

## 🎉 You're Done!

Your Bus Tracker is now:
- ✅ Hosted on Vercel (frontend)
- ✅ Hosted on Render (backend)
- ✅ Completely FREE forever
- ✅ Auto-deploying on every GitHub push
- ✅ Accessible worldwide

**Share your app URL:**
```
https://moveon-go.vercel.app
```

---

## 📱 Testing Checklist

Once deployed:

- [ ] Login with phone number
- [ ] Create a booking
- [ ] See vehicles on map
- [ ] Test all navigation
- [ ] Check console for errors
- [ ] Test on mobile device

---

**Questions?** See RENDER_FREE_DEPLOY.md for backend details.

**Enjoy your live app! 🚀**
