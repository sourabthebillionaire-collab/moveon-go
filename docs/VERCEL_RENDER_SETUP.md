# Vercel + Render Deployment Setup Guide

## Problem
Frontend deployed on Vercel, backend on Render. Clicking "Book Now" from map causes 404 error because frontend still points to localhost.

## Solution

### Step 1: Set Environment Variables on Vercel

1. Go to your Vercel dashboard: https://vercel.com/dashboard
2. Select your frontend project
3. Go to **Settings** → **Environment Variables**
4. Add these variables:

| Key | Value |
|-----|-------|
| `VITE_API_URL` | `https://moveon-go.onrender.com/api` |
| `VITE_SOCKET_URL` | `https://moveon-go.onrender.com` |

**Important**: Make sure these are available for **Production** and **Preview** environments.

### Step 2: Redeploy Frontend on Vercel

After adding environment variables, trigger a new deployment:

1. In Vercel dashboard, go to **Deployments**
2. Click the three dots next to the latest deployment
3. Select **Redeploy** (or push a new commit to trigger automatic redeploy)

The frontend will rebuild with the correct Render backend URLs.

### Step 3: Verify Render Backend is Running

Check that your Render backend is active:

1. Visit: `https://moveon-go.onrender.com/health`
2. You should see: `{ "status": "ok", "service": "MoveOn Go API", ... }`

### Step 4: Test the Flow

1. Go to your Vercel frontend URL
2. Open browser DevTools → **Network** tab
3. Click "Book Now" from the map
4. Verify requests go to `https://moveon-go.onrender.com/api/...` (not localhost)

## If Still Getting 404

Check:
- [ ] Network tab shows requests going to `https://moveon-go.onrender.com`
- [ ] Render `/health` endpoint responds with status 200
- [ ] Vercel environment variables are actually set (not just frontend/.env.production)
- [ ] No CORS errors in browser console
- [ ] Frontend was redeployed AFTER setting env vars

## Common Mistakes

❌ Setting env vars but not redeploying → Frontend still uses old build  
❌ Adding to .env file instead of Vercel settings → Won't be picked up in production build  
❌ Using `http://` instead of `https://` → Blocked by mixed content policy  
❌ Wrong Render URL → Backend not found  

✅ Correct: Set VITE_* vars in Vercel dashboard, redeploy, verify with /health
