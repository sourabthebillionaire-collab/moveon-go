# ✅ QUICK SETUP CHECKLIST

## 🔴 DO THIS NOW (Takes 10 minutes)

```bash
# 1. Go to backend directory
cd backend

# 2. Install new dependencies
npm install

# 3. Create logs directory
mkdir logs

# 4. Generate new JWT_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Copy the output

# 5. Edit .env and update:
#   - JWT_SECRET (paste generated value above)
#   - ADMIN_PASSWORD (set to something like: P@ssw0rd123456)
#   - MONGODB_URI credentials (if needed)
#   - FRONTEND_URL to your production domain

# 6. Test the server
npm run dev

# 7. In another terminal, test the API
curl http://localhost:3001/health

# Expected response: 
# {"status":"ok","service":"MoveOn Go API","version":"1.0.0","uptime":2,"database":"connected"}
```

---

## ✅ VERIFY EVERYTHING WORKS

### Test 1: Rate Limiting
```bash
# Run this 6 times (limit is 5 per 15 minutes on login)
for i in {1..6}; do
  curl -X POST http://localhost:3001/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"phone":"9876543210"}'
  echo "\n---"
done

# Expected: 5 successful, 6th should fail with 429 status
```

### Test 2: CORS Restriction
```bash
# Test from frontend (should work)
curl -X GET http://localhost:3001/health

# Test with different origin (should be rejected by OPTIONS)
curl -X OPTIONS http://localhost:3001/health \
  -H "Origin: https://evil.com"
```

### Test 3: Logs Created
```bash
# Check if logs are being written
ls -la logs/
cat logs/combined.log | tail -20
```

### Test 4: Frontend Timeout
```bash
# Stop the backend, then try API call from frontend
# Expected: "Request timeout (10000ms)" error message
```

---

## 📦 DEPLOYMENT OPTIONS

### For Testing/Development
```bash
npm run dev
```

### For Production (Recommended: Use PM2)
```bash
# Install PM2 globally
npm install -g pm2

# Start server
pm2 start server.js --name "moveon-api"

# Auto-restart on system reboot
pm2 startup

# View logs
pm2 logs moveon-api

# Monitor
pm2 monit
```

---

## 🔒 SECURITY VERIFICATION

- [ ] JWT_SECRET is rotated (not the old weak one)
- [ ] ADMIN_PASSWORD changed to 12+ characters
- [ ] MongoDB URI has strong password
- [ ] `.env` is in `.gitignore` (check with: `git status`)
- [ ] No secrets visible in code files
- [ ] Rate limiting is active
- [ ] CORS is restricted to `FRONTEND_URL`
- [ ] Error logs don't expose sensitive data

---

## 📊 WHAT CHANGED

### Backend Files Updated
- ✅ `server.js` - CORS, rate limiting, env validation, logging
- ✅ `routes/auth.js` - added logging
- ✅ `routes/bookings.js` - added logging
- ✅ `routes/driver.js` - added logging
- ✅ `routes/fare.js` - added logging
- ✅ `package.json` - added winston, joi
- ✅ `.env.example` - updated template

### New Backend Files Created
- ✅ `utils/rateLimiter.js` - rate limiting config
- ✅ `utils/errorHandler.js` - error wrapper, logger integration
- ✅ `SECURITY.md` - security documentation
- ✅ `PRODUCTION_DEPLOYMENT.md` - deployment guide

### Frontend Files Updated
- ✅ `src/services/api.js` - added request timeouts

### Still Need to Update (Optional but Recommended)
- `routes/admin.js`
- `routes/vehicles.js`
- `routes/buses.js`
- `routes/rides.js`

---

## 🚀 NEXT STEPS

1. ✅ Run `npm install` in backend
2. ✅ Create `logs` directory
3. ✅ Update `.env` with new secrets
4. ✅ Run `npm run dev` to test
5. ✅ Run verification tests above
6. 🚀 Deploy to production (see PRODUCTION_DEPLOYMENT.md)

---

## 📞 NEED HELP?

1. Check `backend/logs/error.log` for detailed errors
2. Read `backend/SECURITY.md` for security details
3. Read `backend/PRODUCTION_DEPLOYMENT.md` for deployment options

---

**Status:** All critical security fixes completed ✅
**Estimated Time to Deploy:** 2-4 hours
