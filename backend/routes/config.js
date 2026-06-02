const router = require('express').Router();
const { asyncHandler } = require('../utils/errorHandler');

// GET /api/config — Fetch public configuration values dynamically
router.get('/', asyncHandler(async (req, res) => {
  res.json({
    appName:      process.env.APP_NAME      || 'MoveOnGo',
    alertId:      process.env.ALERT_ID      || '1',
    alertMessage: process.env.ALERT_MESSAGE || '',
    alertSeverity: process.env.ALERT_SEVERITY || 'info', // info | warning | critical
    supportPhone: process.env.SUPPORT_PHONE || '+917328060281',
    upiId:        process.env.UPI_ID        || '7328060281@fam',
    mapCenterLat: Number(process.env.MAP_CENTER_LAT) || 20.296,
    mapCenterLng: Number(process.env.MAP_CENTER_LNG) || 85.824,
    firebase: {
      apiKey:            process.env.FIREBASE_API_KEY,
      authDomain:        process.env.FIREBASE_AUTH_DOMAIN,
      projectId:         process.env.FIREBASE_PROJECT_ID,
      storageBucket:     process.env.FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
      appId:             process.env.FIREBASE_APP_ID,
      vapidKey:          process.env.FIREBASE_VAPID_KEY
    }
  });
}));

module.exports = router;