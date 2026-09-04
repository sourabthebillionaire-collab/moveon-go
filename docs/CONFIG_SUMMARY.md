# 📊 Unfilled Configuration Summary

Quick overview of all places requiring configuration updates for production.

---

## Total Count: **18 Variables to Fill**

### ✅ Already Filled (Development)
- ✅ `MONGODB_URI` - MongoDB Atlas connection (with test credentials)
- ✅ `JWT_SECRET` - Generated 64-character hex string
- ✅ `PORT` - Set to 3001
- ✅ `NODE_ENV` - Set to development
- ✅ `ADMIN_PASSWORD` - Set to default (needs change)
- ✅ `FRONTEND_URL` - Set to localhost:5173
- ✅ `VITE_API_URL` - Set to localhost:3001/api
- ✅ `VITE_SOCKET_URL` - Set to localhost:3001

### ❌ Missing/Not Configured (Production Required)

#### Firebase Configuration - **7 Variables**
1. `FIREBASE_API_KEY` - ❌ Missing
2. `FIREBASE_AUTH_DOMAIN` - ❌ Missing
3. `FIREBASE_PROJECT_ID` - ❌ Missing
4. `FIREBASE_STORAGE_BUCKET` - ❌ Missing
5. `FIREBASE_MESSAGING_SENDER_ID` - ❌ Missing
6. `FIREBASE_APP_ID` - ❌ Missing
7. `FIREBASE_VAPID_KEY` - ❌ Missing (Critical for FCM push notifications)

#### Optional Configuration - **4 Variables** (Have Defaults)
8. `SUPPORT_PHONE` - Default: `+917328060281` (Update with your number)
9. `UPI_ID` - Default: `7328060281@fam` (Update with your ID)
10. `ALERT_MESSAGE` - Default: empty (Optional for announcements)
11. `ALERT_SEVERITY` - Default: `info` (Optional)

#### Optional Configuration - **2 Variables** (Regional)
12. `MAP_CENTER_LAT` - Default: `20.296` (Change if not India)
13. `MAP_CENTER_LNG` - Default: `85.824` (Change if not India)

#### Optional Configuration - **3 Variables** (Naming)
14. `APP_NAME` - Default: `MoveOnGo` (Update if branding differs)
15. `ALERT_ID` - Default: `1` (For alert versioning)
16. `JWT_EXPIRES_IN` - Default: `30d` (Token expiration)

#### To Update Before Production - **2 Variables** (Security)
17. `ADMIN_PASSWORD` - ⚠️ Change from `pujasarkar`
18. `JWT_SECRET` - ⚠️ Generate new strong secret (currently: weak dev key)

---

## 🎯 Priority Breakdown

### 🔴 CRITICAL (Must Configure)
**Count: 9 variables**
- Firebase configuration (7 variables) - Required for push notifications
- `ADMIN_PASSWORD` - Security risk with default
- `JWT_SECRET` - Should be rotated for production
- `NODE_ENV` - Must be `production` for deployment

### 🟠 IMPORTANT (Strongly Recommended)
**Count: 5 variables**
- `VITE_API_URL` - Production backend URL
- `VITE_SOCKET_URL` - Production WebSocket URL
- `FRONTEND_URL` - For CORS and redirects
- `MONGODB_URI` - Production database (if different)
- `SUPPORT_PHONE` - For customer support links

### 🟡 OPTIONAL (Nice to Have)
**Count: 4 variables**
- `UPI_ID` - Payment integration
- `MAP_CENTER_LAT/LNG` - Regional map centering
- `APP_NAME` - Branding
- `ALERT_MESSAGE` - System announcements

---

## 🔍 Where Variables Are Used

### Backend (`backend/.env`)
```
PORT = 3001
NODE_ENV = development ⚠️
MONGODB_URI = [connection string] ✅
JWT_SECRET = [32+ char key] ⚠️
JWT_EXPIRES_IN = 30d
ADMIN_PASSWORD = pujasarkar ⚠️
FRONTEND_URL = http://localhost:5173 ⚠️
APP_NAME = [default: MoveOnGo]
ALERT_ID = [default: 1]
ALERT_MESSAGE = [default: empty]
ALERT_SEVERITY = [default: info]
SUPPORT_PHONE = [default: +917328060281]
UPI_ID = [default: 7328060281@fam]
MAP_CENTER_LAT = [default: 20.296]
MAP_CENTER_LNG = [default: 85.824]
FIREBASE_API_KEY = ❌
FIREBASE_AUTH_DOMAIN = ❌
FIREBASE_PROJECT_ID = ❌
FIREBASE_STORAGE_BUCKET = ❌
FIREBASE_MESSAGING_SENDER_ID = ❌
FIREBASE_APP_ID = ❌
FIREBASE_VAPID_KEY = ❌
```

### Frontend (`frontend.env`)
```
VITE_API_URL = http://localhost:3001/api ⚠️
VITE_SOCKET_URL = http://localhost:3001 ⚠️
```

### Frontend Hardcoded (`frontend/src/firebase.js`)
- Firebase config currently hardcoded ✅ (but should be moved to env)

---

## 📝 Action Items

### Before Development Testing
- [ ] Configure Firebase (if using FCM)
- [ ] Update admin password
- [ ] Generate new JWT secret

### Before Staging Deployment
- [ ] All Firebase variables configured
- [ ] Admin password changed
- [ ] JWT secret rotated
- [ ] Support phone number updated

### Before Production Deployment
- [ ] Set `NODE_ENV=production`
- [ ] Update `VITE_API_URL` to production backend
- [ ] Update `VITE_SOCKET_URL` to production backend
- [ ] Update `FRONTEND_URL` to production frontend
- [ ] Update `MONGODB_URI` if using separate production DB
- [ ] Verify Firebase VAPID key for push notifications
- [ ] Verify all secrets are in deployment platform (not in git)
- [ ] Test `/api/config` endpoint returns all Firebase values

---

## 💡 Quick Links

See [ENVIRONMENT_VARIABLES.md](ENVIRONMENT_VARIABLES.md) for detailed configuration instructions.

**Key files to update:**
- `backend/.env` - Backend configuration
- `frontend.env` - Frontend configuration
- `frontend/src/firebase.js` - Consider moving to env vars

---

**Generated:** June 2, 2026
