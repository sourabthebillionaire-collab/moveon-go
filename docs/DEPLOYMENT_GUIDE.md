# 🚀 Bus Tracker - Heroku Deployment Guide

## Prerequisites
- Heroku account (free tier available at heroku.com)
- Heroku CLI installed (`npm install -g heroku`)
- Git installed and initialized in project
- MongoDB Atlas account (already configured)

---

## 📋 Step-by-Step Deployment

### **STEP 1: Install Heroku CLI** (if not already installed)
```bash
# Download from: https://devcenter.heroku.com/articles/heroku-cli

# After installation, verify:
heroku --version
```

---

### **STEP 2: Login to Heroku**
```bash
heroku login
```
- Opens browser window
- Authenticate with your Heroku account
- Return to terminal (should show "Logged in")

---

### **STEP 3: Create Heroku App**
```bash
cd c:\Users\bacha\bus-tracker

# Create app (replace 'your-app-name' with unique name like 'moveon-go-[yourname]')
heroku create your-app-name
```

Example names:
- `moveon-go-delhi`
- `bus-tracker-app`
- `bustrack-2026`

⚠️ Must be **unique** (lowercase, hyphens only)

---

### **STEP 4: Add MongoDB Atlas URL to Heroku**

First, get your MongoDB connection string:
1. Go to MongoDB Atlas: https://www.mongodb.com/cloud/atlas
2. Login to your account
3. Click "Connect" on your cluster
4. Select "Drivers" → Copy connection string
5. Replace `<username>`, `<password>`, and `<cluster-name>`

Then set it on Heroku:
```bash
heroku config:set MONGODB_URI="mongodb+srv://username:password@cluster.mongodb.net/moveon?retryWrites=true&w=majority" -a your-app-name
```

---

### **STEP 5: Set Production Environment Variables**

Run these commands (replace values as needed):

```bash
# Generate a strong JWT secret (copy the output)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Set all environment variables
heroku config:set NODE_ENV=production -a your-app-name
heroku config:set JWT_SECRET=<paste-the-generated-secret-here> -a your-app-name
heroku config:set ADMIN_PASSWORD=your-secure-admin-password -a your-app-name
heroku config:set FRONTEND_URL=https://your-app-name.herokuapp.com -a your-app-name

# Verify all variables are set
heroku config -a your-app-name
```

---

### **STEP 6: Add Buildpacks** (tells Heroku how to build Node+React)

```bash
# Add Node buildpack
heroku buildpacks:add heroku/nodejs -a your-app-name

# View buildpacks
heroku buildpacks -a your-app-name
```

---

### **STEP 7: Deploy to Heroku**

```bash
# Add remote if not done automatically
git remote add heroku https://git.heroku.com/your-app-name.git

# Or update if it exists
git remote set-url heroku https://git.heroku.com/your-app-name.git

# First, make sure everything is committed to git
git add .
git commit -m "Ready for production deployment"

# Deploy! (this will build and start your app)
git push heroku main
```

⏳ **Wait 3-5 minutes** for deployment to complete

---

### **STEP 8: View Logs**

While deploying, watch the logs:
```bash
heroku logs --tail -a your-app-name
```

Look for:
- ✅ "MongoDB connected ✅"
- ✅ "Server running on port" 
- ✅ "Buildpack setup complete"

---

### **STEP 9: Verify Deployment**

```bash
# Get your app URL
heroku apps:info your-app-name

# Test health endpoint
curl https://your-app-name.herokuapp.com/health

# Should return:
# {"status":"ok","service":"MoveOn Go API","version":"1.0.0","database":"connected"}
```

---

### **STEP 10: Access Your App**

Open browser and visit:
```
https://your-app-name.herokuapp.com
```

🎉 Your app is now LIVE!

---

## 🔍 Troubleshooting

### **Build fails with "node_modules not found"**
```bash
heroku build:cache:purge -a your-app-name
git push heroku main
```

### **MongoDB connection error**
```bash
# Verify MongoDB URI is set
heroku config -a your-app-name

# Check if connection string is correct
heroku logs -a your-app-name
```

### **Frontend not loading (shows API errors)**
```bash
# Verify FRONTEND_URL is set
heroku config:get FRONTEND_URL -a your-app-name

# Should be: https://your-app-name.herokuapp.com
```

### **App crashes with no logs**
```bash
heroku logs -a your-app-name --source app
heroku logs -a your-app-name --source build
```

---

## 📱 Testing After Deployment

Once deployed, test these:

1. **Login** - Go to app, enter phone number
2. **Book a Ride** - Select vehicle and destination
3. **Live Map** - Check vehicle tracking
4. **API** - Test `/health` endpoint

---

## 🔐 Security Checklist

- ✅ JWT_SECRET is strong (30+ characters)
- ✅ MONGODB_URI only in Heroku config (not in git)
- ✅ NODE_ENV set to 'production'
- ✅ FRONTEND_URL matches app domain
- ✅ Admin password is secure
- ✅ Rate limiting enabled on API

---

## 📈 After Deployment

### Monitor Your App
```bash
# View real-time logs
heroku logs --tail -a your-app-name

# View app metrics
heroku metrics -a your-app-name

# Get app status
heroku ps -a your-app-name
```

### Update Your App
```bash
# Make changes locally, then:
git add .
git commit -m "your message"
git push heroku main
```

### Scale (if needed)
```bash
# Free tier: 1 web dyno (550 hours/month)
# Paid: Scale to multiple dynos
heroku ps:scale web=1 -a your-app-name
```

---

## 💡 Pro Tips

1. **Use a custom domain:**
   ```bash
   heroku domains:add yourdomain.com -a your-app-name
   ```

2. **Enable auto-deploy from GitHub:**
   - Go to Heroku Dashboard → Connect to GitHub
   - Auto-deploy on push to main branch

3. **Backup MongoDB regularly:**
   - Use MongoDB Atlas backup feature
   - Set up automatic backups

4. **Monitor performance:**
   ```bash
   heroku metrics -a your-app-name
   ```

---

## ✅ You're Done!

Your Bus Tracker app is now deployed on Heroku and accessible worldwide! 🌍

**App URL:** `https://your-app-name.herokuapp.com`  
**Backend API:** `https://your-app-name.herokuapp.com/api`  
**Health Check:** `https://your-app-name.herokuapp.com/health`

Need help? Check Heroku docs: https://devcenter.heroku.com/
