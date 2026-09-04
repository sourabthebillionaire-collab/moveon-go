# ⚡ Quick Deploy Commands - Copy & Paste Ready

## Prerequisites ✓
- [ ] Heroku CLI installed (`npm install -g heroku`)
- [ ] Heroku account created (free)
- [ ] MongoDB URI ready (from Atlas)
- [ ] Git initialized in project

---

## 🚀 Fast Deploy (Copy & Paste These Commands)

### 1️⃣ Login to Heroku
```bash
heroku login
```

### 2️⃣ Create App (CHOOSE A UNIQUE NAME)
```bash
# Replace 'myapp' with your unique app name
heroku create myapp

# Example: heroku create moveon-go-2026
```

### 3️⃣ Set MongoDB Connection
```bash
# Copy your MongoDB connection string from Atlas
# Format: mongodb+srv://username:password@cluster.mongodb.net/moveon

heroku config:set MONGODB_URI="your_mongodb_connection_string_here" -a myapp
```

### 4️⃣ Generate JWT Secret & Set Variables
```bash
# Run this to generate random secret (copy output)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Then set all config (replace myapp with your app name)
heroku config:set NODE_ENV=production -a myapp
heroku config:set JWT_SECRET="paste_generated_secret_here" -a myapp
heroku config:set ADMIN_PASSWORD="ChooseAStrongPassword123!" -a myapp
heroku config:set FRONTEND_URL="https://myapp.herokuapp.com" -a myapp

# Verify all set
heroku config -a myapp
```

### 5️⃣ Add Node.js Buildpack
```bash
heroku buildpacks:add heroku/nodejs -a myapp
```

### 6️⃣ Deploy!
```bash
# Navigate to project root
cd c:\Users\bacha\bus-tracker

# Commit changes
git add .
git commit -m "Deployment ready"

# Push to Heroku (wait 3-5 minutes)
git push heroku main

# Watch logs
heroku logs --tail -a myapp
```

### 7️⃣ Test
```bash
# Test health endpoint
curl https://myapp.herokuapp.com/health

# Should see: {"status":"ok","service":"MoveOn Go API",...,"database":"connected"}

# Open in browser
https://myapp.herokuapp.com
```

---

## 📋 Required Information Before Deployment

**Have these ready:**

1. **MongoDB Connection String**
   - From: mongodb.com/cloud/atlas
   - Format: `mongodb+srv://user:pass@cluster.mongodb.net/moveon`

2. **JWT Secret** (generate with command above)
   - Example: `a3f5b8c2d9e1f4g7h0i3j6k9l2m5n8o1`

3. **Admin Password** (you choose)
   - Example: `BusTracker@2026!`

4. **App Name** (must be unique, lowercase, hyphens ok)
   - Examples: `moveon-go-delhi`, `bustrack-app`, `tracker-2026`

---

## ✅ Deployment Complete When You See:

```
-----> Node.js app detected
-----> Installing dependencies
-----> Building frontend
-----> React build successful
-----> Starting server
2026-05-11 08:XX:XX +0000] MongoDB connected ✅
2026-05-11 08:XX:XX +0000] Server running on port 3001 ✅
```

Then visit: **https://your-app-name.herokuapp.com** 🎉

---

## 🆘 If Deployment Fails

### Check logs:
```bash
heroku logs -a myapp --tail
```

### Common fixes:
```bash
# Clear cache and retry
heroku build:cache:purge -a myapp
git push heroku main

# Check env variables
heroku config -a myapp

# Restart app
heroku restart -a myapp
```

---

## 📊 After Deployment Commands

```bash
# View live logs
heroku logs --tail -a myapp

# Check app status
heroku ps -a myapp

# View metrics
heroku metrics -a myapp

# Update app (after making changes)
git add .
git commit -m "update"
git push heroku main
```

---

## 🎯 Test Your Deployed App

1. Open: `https://your-app-name.herokuapp.com`
2. Enter phone number and login
3. Try booking a ride
4. Check live map
5. Test API: `https://your-app-name.herokuapp.com/health`

---

**That's it! You're deployed! 🚀**

For detailed help, see `DEPLOYMENT_GUIDE.md`
