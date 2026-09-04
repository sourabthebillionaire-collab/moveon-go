# 🔧 Environment Variables & Configuration Checklist

Complete list of all variables that need to be filled in for production deployment.

---

## 📋 Backend Configuration

### **File: `backend/.env`**

| Variable | Current Value | Required | Type | Notes |
|----------|---------------|----------|------|-------|
| `PORT` | `3001` | ✅ | Number | Server port (change for production) |
| `NODE_ENV` | `development` | ✅ | String | Set to `production` for deployment |
| `MONGODB_URI` | ✅ MongoDB Atlas connection | ✅ | String | **⚠️ Contains credentials** - Update for production |
| `JWT_SECRET` | ✅ 64-char hex string | ✅ | String | **⚠️ ROTATE before production** |
| `JWT_EXPIRES_IN` | `30d` | ✅ | String | Token expiration time |
| `ADMIN_PASSWORD` | `pujasarkar` | ✅ | String | **⚠️ CHANGE THIS** - Very important! |
| `FRONTEND_URL` | `http://localhost:5173` | ✅ | String | Update to production frontend URL |

### **Optional Backend Variables** (Fall back to defaults)

| Variable | Default | Purpose |
|----------|---------|---------|
| `APP_NAME` | `MoveOnGo` | App branding in config endpoint |
| `ALERT_ID` | `1` | Alert/notification identifier |
| `ALERT_MESSAGE` | `` (empty) | Global alert message for users |
| `ALERT_SEVERITY` | `info` | Alert severity: `info` \| `warning` \| `critical` |
| `SUPPORT_PHONE` | `+917328060281` | Customer support phone number |
| `UPI_ID` | `7328060281@fam` | UPI payment ID for payments |
| `MAP_CENTER_LAT` | `20.296` | Map center latitude (for India) |
| `MAP_CENTER_LNG` | `85.824` | Map center longitude (for India) |

### **Firebase Configuration Variables** (Backend)

These are served by `/api/config` endpoint to frontend.

| Variable | Status | Type | Notes |
|----------|--------|------|-------|
| `FIREBASE_API_KEY` | ❌ MISSING | String | Get from Firebase Console |
| `FIREBASE_AUTH_DOMAIN` | ❌ MISSING | String | Example: `your-project.firebaseapp.com` |
| `FIREBASE_PROJECT_ID` | ❌ MISSING | String | Your Firebase project ID |
| `FIREBASE_STORAGE_BUCKET` | ❌ MISSING | String | Example: `your-project.appspot.com` |
| `FIREBASE_MESSAGING_SENDER_ID` | ❌ MISSING | String | For FCM push notifications |
| `FIREBASE_APP_ID` | ❌ MISSING | String | Firebase app ID |
| `FIREBASE_VAPID_KEY` | ❌ MISSING | String | **For web push notifications** |

---

## 🎨 Frontend Configuration

### **File: `frontend.env` (Development)**

| Variable | Current Value | Required | Type | Notes |
|----------|---------------|----------|------|-------|
| `VITE_API_URL` | `http://localhost:3001/api` | ✅ | String | Update for production backend URL |
| `VITE_SOCKET_URL` | `http://localhost:3001` | ✅ | String | WebSocket URL for real-time features |

### **Frontend Environment Variables** (Optional)

These variables are referenced in code but have defaults:

| Variable | Location | Default | Purpose |
|----------|----------|---------|---------|
| `VITE_SUPPORT_PHONE` | `frontend/src/pages/Driver.jsx` | `+910000000000` | Driver support phone link |
| `VITE_UPI_ID` | `frontend/src/pages/BookRide.jsx` | From `/api/config` | UPI payment ID |
| `VITE_APP_NAME` | `frontend/src/pages/BookRide.jsx` | From `/api/config` | App branding |
| `VITE_FIREBASE_*` | `frontend/src/services/fcm.js` | From `/api/config` | Firebase config (served by backend) |

### **Hardcoded Firebase Config in Frontend** ⚠️

**File:** `frontend/src/firebase.js`

Currently has hardcoded values:
```javascript
{
  apiKey: "AIzaSyA73xYd4Ks_5lDspe0j88SyhGLWIYVlqR0",
  authDomain: "bus-tracker-db6ee.firebaseapp.com",
  projectId: "bus-tracker-db6ee",
  storageBucket: "bus-tracker-db6ee.appspot.com",
  messagingSenderId: "46705530696",
  appId: "1:46705530696:web:98f1ddea79e37601d9057d"
}
```

**Status:** ✅ Configured for development  
**For Production:** Consider moving to environment variables

---

## 📝 Quick Reference: Production Checklist

### Critical (Must Change Before Deployment)

- [ ] **Backend**: Change `NODE_ENV=production`
- [ ] **Backend**: Change `ADMIN_PASSWORD` from `pujasarkar`
- [ ] **Backend**: Generate new `JWT_SECRET` (32+ characters)
- [ ] **Backend**: Update `MONGODB_URI` if using different production database
- [ ] **Backend**: Update `FRONTEND_URL` to production domain
- [ ] **Frontend**: Update `VITE_API_URL` to production backend URL
- [ ] **Frontend**: Update `VITE_SOCKET_URL` to production WebSocket URL
- [ ] **Backend**: Add Firebase environment variables (if using FCM)

### Important (Recommended)

- [ ] **Backend**: Update `APP_NAME` if not using "MoveOnGo"
- [ ] **Backend**: Update `SUPPORT_PHONE` with your support number
- [ ] **Backend**: Update `UPI_ID` with your payment ID
- [ ] **Backend**: Set `MAP_CENTER_LAT` & `MAP_CENTER_LNG` for your region
- [ ] **Frontend**: Consider moving Firebase config to environment variables

### Optional

- [ ] **Backend**: Set `ALERT_MESSAGE` for important announcements
- [ ] **Backend**: Set `ALERT_SEVERITY` level for alerts

---

## 🚀 How to Generate Missing Values

### JWT Secret (Backend)

```bash
# On Linux/Mac
openssl rand -hex 32

# On Windows PowerShell
[System.Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32))

# Result: Use the generated string for JWT_SECRET
```

### Firebase Configuration

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Create a new project or select existing one
3. Go to Project Settings → General tab
4. Scroll to "Your apps" section → Select/Create web app
5. Copy the config object values:
   - apiKey
   - authDomain
   - projectId
   - storageBucket
   - messagingSenderId
   - appId
6. For VAPID Key:
   - Cloud Messaging tab → Web push certificates
   - Generate new key pair or copy existing

### MongoDB URI

If using MongoDB Atlas:
1. Log into [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Cluster → Connect → Drivers → Node.js
3. Copy connection string
4. Replace `<password>` and `<username>`
5. Update `MONGODB_URI` in backend `.env`

---

## 🔐 Security Notes

### Variables to Keep Secure

- ✅ `JWT_SECRET` - Never commit to Git
- ✅ `MONGODB_URI` - Contains database credentials
- ✅ `ADMIN_PASSWORD` - Don't use defaults
- ✅ `FIREBASE_API_KEY` - Can be public (web key)
- ⚠️ `FIREBASE_MESSAGING_SENDER_ID` - Should be private

### Git Protection

Make sure `.env` files are in `.gitignore`:

```
backend/.env
frontend/.env
*.env
```

---

## 📊 Configuration Matrix

### Development Setup
| Component | Local Dev |
|-----------|-----------|
| Backend | `http://localhost:3001` |
| Frontend | `http://localhost:5173` |
| Database | MongoDB Atlas (shared) |
| API URL | `http://localhost:3001/api` |
| Socket URL | `http://localhost:3001` |

### Production Setup
| Component | Production |
|-----------|------------|
| Backend | Your backend domain (e.g., Heroku, Render) |
| Frontend | Your frontend domain (e.g., Vercel, Netlify) |
| Database | MongoDB Atlas (production cluster) |
| API URL | `https://your-backend.com/api` |
| Socket URL | `https://your-backend.com` |

---

## ✅ Complete Deployment Verification

Before going live, ensure all of these are configured:

```
Backend Configuration:
  ✅ NODE_ENV = production
  ✅ JWT_SECRET = (strong 32+ char secret)
  ✅ ADMIN_PASSWORD = (changed from default)
  ✅ MONGODB_URI = (production database)
  ✅ FRONTEND_URL = (production frontend)
  ✅ Firebase vars = (if using FCM)

Frontend Configuration:
  ✅ VITE_API_URL = (production backend)
  ✅ VITE_SOCKET_URL = (production backend)
  ✅ Firebase config = (updated for production)

Deployment:
  ✅ .env files NOT in Git
  ✅ Secrets set in deployment platform
  ✅ HTTPS enabled on both frontend & backend
  ✅ MongoDB Atlas whitelist includes server IP
```

---

## 📞 Support Links

- [Firebase Console](https://console.firebase.google.com)
- [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
- [Heroku Deployment](https://www.heroku.com)
- [Render Deployment](https://render.com)
- [Vercel Deployment](https://vercel.com)

---

**Last Updated:** June 2, 2026  
**Status:** Ready for Production Configuration
