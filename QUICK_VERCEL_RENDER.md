# ⚡ Quick Start: Vercel + Render Deployment

**Everything you need, copy-paste ready!**

---

## 🎯 5-Minute Overview

```
1. Deploy Backend to Render (3 min)
2. Deploy Frontend to Vercel (2 min)
3. Done! ✅
```

---

## 📋 Have These Ready

- [ ] GitHub account (already have)
- [ ] Vercel account (free, sign up with GitHub)
- [ ] Render account (free, sign up with GitHub)
- [ ] MongoDB URI (from Atlas)
- [ ] Random JWT Secret (generate below)

**Generate JWT Secret:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## 🚀 Step 1: Deploy Backend (Render) - 3 minutes

1. **Go to:** https://render.com
2. **Sign up** with GitHub
3. **Click:** "New +" → "Web Service"
4. **Select:** "moveon-go" repo
5. **Fill:**
   ```
   Name: bus-tracker-backend
   Build: cd backend && npm install
   Start: cd backend && npm start
   ```
6. **Click Advanced → Add Variables:**
   ```
   MONGODB_URI = mongodb+srv://...
   JWT_SECRET = (your generated secret)
   ADMIN_PASSWORD = YourPassword123!
   NODE_ENV = production
   FRONTEND_URL = https://your-frontend.vercel.app
   ```
7. **Click "Create"** → Wait 3-5 min

**Copy your Render URL:** `https://bus-tracker-backend.onrender.com`

---

## 🚀 Step 2: Deploy Frontend (Vercel) - 2 minutes

1. **Go to:** https://vercel.com
2. **Sign up** with GitHub
3. **Click:** "Add New" → "Project"
4. **Select:** "moveon-go" repo
5. **Choose Framework:** Vite (auto-detected)
6. **Root Directory:** `frontend`
7. **Click "Advanced"** → **Add Environment:**
   ```
   VITE_API_URL = https://bus-tracker-backend.onrender.com/api
   VITE_SOCKET_URL = https://bus-tracker-backend.onrender.com
   ```
8. **Click "Deploy"** → Wait 2-3 min

**Copy your Vercel URL:** `https://your-project.vercel.app`

---

## 🔄 Step 3: Update Backend (1 minute)

Go back to Render and update:

1. **Click** on "bus-tracker-backend"
2. **Go to** Environment
3. **Update:** `FRONTEND_URL = https://your-project.vercel.app`
4. **Click** "Redeploy"

---

## ✅ Done!

Your app is now live at:
```
https://your-project.vercel.app
```

---

## 🧪 Quick Tests

```bash
# Test Backend
curl https://bus-tracker-backend.onrender.com/health

# Test Frontend
Open: https://your-project.vercel.app
```

---

## 📊 Cost Summary

```
Vercel:  $0/month (FREE forever)
Render:  $0/month (FREE forever)
Total:   $0/month ✅
```

---

## 🔄 Auto-Deploys

Every time you push to GitHub:

```bash
git push origin main
```

Both Vercel and Render auto-deploy! 🎉

---

## 🆘 Stuck?

See full guide: **VERCEL_RENDER_DEPLOY.md**

**You got this!** 🚀
