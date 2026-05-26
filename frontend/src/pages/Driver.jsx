import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import api from '../services/api';
import { emitLocation, onRideRequest, connectSocket, disconnectSocket, getSocket, joinBookingRoom } from '../services/socket';
import { setDriverSession, getDriver, getDriverToken, clearDriverSession, getActiveDriverRide, setActiveDriverRide, clearActiveDriverRide } from '../services/storage';
import { watchPosition } from '../services/geocoding';
import './Driver.css';

// ── Language strings ──────────────────────────────────────────
const T = {
  en: {
    step1Title:    'Driver Sign In',
    step1Sub:      'Enter your assigned Vehicle ID',
    vehicleIdLabel:'Vehicle ID',
    vehicleIdPh:   'e.g. OD-05-BUS-001',
    next:          'Continue',
    step2Title:    'Enter PIN',
    step2Sub:      'Enter your 4-digit security PIN',
    pinLabel:      'Security PIN',
    pinPh:         '• • • •',
    back:          'Back',
    signIn:        'Sign In',
    signing:       'Verifying...',
    validating:    'Validating...',
    errInvalidId:  'Vehicle ID not found in system. Contact admin.',
    errWrongPin:   'Incorrect PIN. Please try again.',
    errServer:     'Server unreachable. Check your connection.',
    onDuty:        'ON DUTY',
    offDuty:       'OFF DUTY',
    startDuty:     'Start Duty',
    endDuty:       'End Duty',
    gpsActive:     'GPS Active',
    speed:         'Speed',
    trips:         'Trips',
    earned:        'Earned',
    passengers:    'Passengers',
    newRide:       'New Ride Request',
    from:          'Pickup',
    to:            'Drop',
    fare:          'Fare',
    distance:      'Distance',
    eta:           'ETA',
    accept:        'Accept',
    decline:       'Decline',
    startTrip:     'Start Trip',
    endTrip:       'End Trip',
    navigate:      'Navigate to Pickup',
    navigateDrop:  'Navigate to Drop',
    scanQr:        'Scan Rider QR',
    cashReceived:  'Cash Received',
    techSupport:   'Technical Support',
    confirmCash:   'Cash collection acknowledged.',
    cancelRide:    'Cancel Ride',
    reportIssue:   'Report Issue',
    callControl:   'Call Control Room',
    sos:           'SOS Emergency',
    signOut:       'Sign Out',
    todaySummary:  "Today's Summary",
    confirmEnd:    'End duty and go offline?',
    confirmSos:    'Send SOS alert to control room?',
    lang:          'EN',
  },
  hi: {
    step1Title:    'ड्राइवर साइन इन',
    step1Sub:      'अपना वाहन ID दर्ज करें',
    vehicleIdLabel:'वाहन ID',
    vehicleIdPh:   'जैसे OD-05-BUS-001',
    next:          'आगे बढ़ें',
    step2Title:    'PIN दर्ज करें',
    step2Sub:      'अपना 4 अंकों का सुरक्षा PIN दर्ज करें',
    pinLabel:      'सुरक्षा PIN',
    pinPh:         '• • • •',
    back:          'वापस',
    signIn:        'साइन इन',
    signing:       'जाँच हो रही है...',
    validating:    'जाँच हो रही है...',
    errInvalidId:  'वाहन ID नहीं मिला। एडमिन से संपर्क करें।',
    errWrongPin:   'गलत PIN। फिर कोशिश करें।',
    errServer:     'सर्वर से कनेक्ट नहीं हो सका।',
    onDuty:        'ड्यूटी पर',
    offDuty:       'ड्यूटी बंद',
    startDuty:     'ड्यूटी शुरू',
    endDuty:       'ड्यूटी बंद',
    gpsActive:     'GPS चालू',
    speed:         'रफ्तार',
    trips:         'यात्राएं',
    earned:        'कमाई',
    passengers:    'यात्री',
    newRide:       'नई राइड रिक्वेस्ट',
    from:          'पिकअप',
    to:            'ड्रॉप',
    fare:          'किराया',
    distance:      'दूरी',
    eta:           'समय',
    accept:        'स्वीकार करें',
    decline:       'मना करें',
    startTrip:     'यात्रा शुरू',
    endTrip:       'यात्रा खत्म',
    navigate:      'पिकअप पर जाएं',
    navigateDrop:  'ड्रॉप पर जाएं',
    scanQr:        'QR स्कैन करें',
    cashReceived:  'नकद प्राप्त हुआ',
    techSupport:   'तकनीकी सहायता',
    confirmCash:   'नकद प्राप्ति की पुष्टि हुई।',
    cancelRide:    'राइड रद्द करें',
    reportIssue:   'समस्या बताएं',
    callControl:   'कंट्रोल रूम कॉल',
    sos:           'SOS आपातकाल',
    signOut:       'साइन आउट',
    todaySummary:  'आज का हिसाब',
    confirmEnd:    'ड्यूटी बंद करें?',
    confirmSos:    'SOS अलर्ट भेजें?',
    lang:          'हि',
  },
  or: {
    step1Title:    'ଡ୍ରାଇଭର ସାଇନ ଇନ',
    step1Sub:      'ଆପଣଙ୍କ ଗାଡ଼ି ID ଦିଅନ୍ତୁ',
    vehicleIdLabel:'ଗାଡ଼ି ID',
    vehicleIdPh:   'ଯଥା OD-05-BUS-001',
    next:          'ଆଗକୁ ଯାଆନ୍ତୁ',
    step2Title:    'PIN ଦିଅନ୍ତୁ',
    step2Sub:      'ଆପଣଙ୍କ 4 ସଂଖ୍ୟା PIN ଦିଅନ୍ତୁ',
    pinLabel:      'ସୁରକ୍ଷା PIN',
    pinPh:         '• • • •',
    back:          'ଫେରନ୍ତୁ',
    signIn:        'ସାଇନ ଇନ',
    signing:       'ଯାଞ୍ଚ ହେଉଛି...',
    validating:    'ଯାଞ୍ଚ ହେଉଛି...',
    errInvalidId:  'ଗାଡ଼ି ID ମିଳିଲା ନାହିଁ। Admin ଙ୍କୁ ଯୋଗାଯୋଗ କରନ୍ତୁ।',
    errWrongPin:   'ଭୁଲ PIN। ପୁଣି ଚେଷ୍ଟା କରନ୍ତୁ।',
    errServer:     'ସର୍ଭର ସଂଯୋଗ ହେଲା ନାହିଁ।',
    onDuty:        'ଡ୍ୟୁଟିରେ',
    offDuty:       'ଡ୍ୟୁଟି ବନ୍ଦ',
    startDuty:     'ଡ୍ୟୁଟି ଆରମ୍ଭ',
    endDuty:       'ଡ୍ୟୁଟି ଶେଷ',
    gpsActive:     'GPS ଚାଲୁ',
    speed:         'ବେଗ',
    trips:         'ଯାତ୍ରା',
    earned:        'ରୋଜଗାର',
    passengers:    'ଯାତ୍ରୀ',
    newRide:       'ନୂଆ ରାଇଡ ରିକ୍ୱେଷ୍ଟ',
    from:          'ଉଠାଇବା ଜାଗା',
    to:            'ଛାଡ଼ିବା ଜାଗା',
    fare:          'ଭଡ଼ା',
    distance:      'ଦୂରତ୍ୱ',
    eta:           'ସମୟ',
    accept:        'ଗ୍ରହଣ କରନ୍ତୁ',
    decline:       'ମନା କରନ୍ତୁ',
    startTrip:     'ଯାତ୍ରା ଆରମ୍ଭ',
    endTrip:       'ଯାତ୍ରା ଶେଷ',
    navigate:      'ଉଠାଇବା ସ୍ଥାନକୁ ଯାଆନ୍ତୁ',
    navigateDrop:  'ଛାଡ଼ିବା ସ୍ଥାନକୁ ଯାଆନ୍ତୁ',
    scanQr:        'QR ସ୍କାନ୍ କରନ୍ତୁ',
    cashReceived:  'ନଗଦ ଗ୍ରହଣ କଲେ',
    techSupport:   'ଯାନ୍ତ୍ରିକ ସହାୟତା',
    confirmCash:   'ନଗଦ ଗ୍ରହଣ ସଫଳ ହେଲା।',
    cancelRide:    'ରାଇଡ୍ ବାତିଲ କରନ୍ତୁ',
    reportIssue:   'ସମସ୍ୟା ଜଣାନ୍ତୁ',
    callControl:   'କଣ୍ଟ୍ରୋଲ ରୁମ କଲ',
    sos:           'SOS ଜରୁରୀ',
    signOut:       'ସାଇନ ଆଉଟ',
    todaySummary:  'ଆଜିର ହିସାବ',
    confirmEnd:    'ଡ୍ୟୁଟି ଶେଷ କରିବେ?',
    confirmSos:    'SOS ଆଲର୍ଟ ପଠାଇବେ?',
    lang:          'ଓଡ଼ି',
  },
};

const ISSUES = [
  { en: 'Breakdown',       hi: 'गाड़ी खराब',    or: 'ଗାଡ଼ି ଖରାପ' },
  { en: 'Traffic',         hi: 'ट्रैफिक',        or: 'ଟ୍ରାଫିକ'    },
  { en: 'No Fuel',         hi: 'पेट्रोल नहीं',  or: 'ତେଲ ନାହିଁ'  },
  { en: 'Medical',         hi: 'मेडिकल',         or: 'ଡାକ୍ତର'     },
  { en: 'Passenger Issue', hi: 'यात्री समस्या',  or: 'ଯାତ୍ରୀ ସମ'  },
  { en: 'Other',           hi: 'अन्य',           or: 'ଅନ୍ୟ'       },
];

function speak(text, lang) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang === 'hi' ? 'hi-IN' : lang === 'or' ? 'or-IN' : 'en-IN';
  u.rate = 0.9; u.volume = 1;
  window.speechSynthesis.speak(u);
}

// ── Main Component ────────────────────────────────────────────
export default function Driver() {
  const navigate = useNavigate();

  // Auth state
  const [lang,      setLang]      = useState('en');
  const [step,      setStep]      = useState('id');   // id | pin | panel
  const [vehicleId, setVehicleId] = useState('');
  const [pin,       setPin]       = useState('');
  const [error,     setError]     = useState('');
  const [busy,      setBusy]      = useState(false);
  const [driver,    setDriver]    = useState(() => getDriver());
  const [kickedMsg, setKickedMsg] = useState('');
  const pinInputRef = useRef(null);

  // Panel state
  const [onDuty,     setOnDuty]    = useState(false);
  const [gpsPos,     setGpsPos]    = useState(null);
  const [speed,      setSpeed]     = useState(0);
  const [tripCount,  setTripCount] = useState(0);
  const [earnings,   setEarnings]  = useState(0);
  const [passengers, setPassengers]= useState(0);
  const [tripActive, setTripActive]= useState(false);
  const [rideReq,    setRideReq]   = useState(null);
  const [activeRide, setActiveRide]= useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [issueSheet, setIssueSheet]= useState(false);
  const [socketDebug, setSocketDebug] = useState([]);
  const [toast,       setToast]       = useState(null);
  const [gpsError,   setGpsError]  = useState(false);
  const [gpsStale,   setGpsStale]  = useState(false);
  const [socketConnected, setSocketConnected] = useState(false);
  const [maxAttemptsReached, setMaxAttemptsReached] = useState(false);
  const unwatchRef   = useRef(null);
  const pingRef      = useRef(null);
  const gpsPosRef    = useRef(null); // keep GPS pos accessible in interval closure
  const lastEmitRef  = useRef(0);    // FIX: Throttle redundant emissions
  const lastMovementRef  = useRef(Date.now());
  const lastGpsUpdateRef = useRef(Date.now());
  const healthAlertSentRef = useRef(false);
  const reconnectAttemptsRef = useRef(0);
  const MAX_RECONNECT_ATTEMPTS = 3;
  const toastTimeoutRef = useRef(null);

  // BUG FIX: Use Refs for values used in watchPosition/Interval closures to prevent stale data
  const activeRideRef = useRef(null);
  const passengersRef = useRef(0);
  const driverRef     = useRef(null);

  useEffect(() => { activeRideRef.current = activeRide; }, [activeRide]);
  useEffect(() => { passengersRef.current = passengers; }, [passengers]);
  useEffect(() => { driverRef.current     = driver;     }, [driver]);

  const t = T[lang];

  // ── Restore session on mount ────────────────────────────────
  useEffect(() => {
    const token = getDriverToken();
    const saved = getDriver();
    if (!token || !saved) return;

    (async () => {
      try {
        const socket = connectSocket();
        const driverId = saved.id || saved._id;
        const vehicleType = saved.vehicleType;

        // Ensure clean state before adding listeners
        socket.off('driver:kicked');
        socket.off('connect');

        // FIX #11: Re-register on every reconnect so driver stays in their
        // personal room through socket disconnects. Previously registered once
        // on mount — after any reconnect the driver missed kicked/offline events.
        const handleReconnect = () => {
          const token = getDriverToken();
          socket.emit('driver:register', { driverId, vehicleType, token });
          console.log('[Driver] Registered with server:', driverId);
          setSocketConnected(true);
        };

        if (socket.connected) setSocketConnected(true);
        socket.on('connect', handleReconnect);
        socket.on('disconnect', () => setSocketConnected(false));

        socket.on('driver:kicked', ({ reason }) => {
          unwatchRef.current?.();
          clearInterval(pingRef.current);
          disconnectSocket();
          clearDriverSession();
          setDriver(null);
          setOnDuty(false);
          setStep('id');
          setKickedMsg(reason || 'Your account has been removed by admin.');
        });

        const profile = await api.getDriverProfile(token);
        if (profile?.driver) {
          setDriver(profile.driver);
          setDriverSession(profile.driver, token);
          // BUG FIX #9: Sync duty state from DB on restore
          setOnDuty(!!profile.driver.onDuty);
        }

        // FIX: Verify stored ride is still live in DB before restoring it.
        // Root cause of "Failed to start the ride": localStorage had an old
        // accepted booking that was cancelled while driver was offline.
        // startRide() would call PUT /start → 404 → alert. Now we check first.
        const storedRide = getActiveDriverRide();
        if (storedRide) {
          try {
            const { booking: liveBooking } = await api.getDriverActiveBooking(token);
            if (liveBooking && ['accepted', 'started'].includes(liveBooking.status)) {
              const verifiedRide = {
                id:         liveBooking._id,
                status:     liveBooking.status,
                pickup:     liveBooking.pickup,
                dropoff:    liveBooking.dropoff,
                fare:       liveBooking.fare,
                fareAmount: liveBooking.fareAmount,
                distance:   liveBooking.distance,
                duration:   liveBooking.duration,
                type:       liveBooking.vehicleType,
                pickupLat:  liveBooking.pickupLat,
                pickupLng:  liveBooking.pickupLng,
                dropoffLat: liveBooking.dropoffLat,
                dropoffLng: liveBooking.dropoffLng,
                payment:    liveBooking.payment,
              };
              setActiveRide(verifiedRide);
              setActiveDriverRide(verifiedRide);
              joinBookingRoom(verifiedRide.id);
              setOnDuty(true);
              setTripActive(liveBooking.status === 'started');
              setPassengers(liveBooking.status === 'started' ? 1 : 0);
            } else {
              clearActiveDriverRide(); 
              setActiveRide(null);
            }
          } catch {
            // Network failure — keep stored ride optimistically but don't set tripActive
            setActiveRide(storedRide);
            setTripActive(false);
            setOnDuty(true);
          }
        }

        // ✅ CRITICAL FIX: Ensure tracking starts immediately on session restore if On Duty
        if (profile?.driver?.onDuty || storedRide) {
          startTracking();
        }

        setStep('panel');
      } catch (err) {
        if (err.status === 401 || err.status === 404) {
          clearDriverSession();
          setDriver(null);
          setKickedMsg('Your account no longer exists. Contact admin.');
        } else {
          setStep('panel');
        }
      }
    })();

    return () => {
      const socket = getSocket();
      socket?.off('driver:kicked');
      socket?.off('connect');
    };
  }, []);

  // ✅ BUG FIX: Move nested useEffect to top level
  // UX Improvement: Listen for real-time approval if waiting on ID screen
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleApproved = ({ vehicleId: approvedId }) => {
      if (step === 'id' && vehicleId.trim().toUpperCase() === approvedId.toUpperCase()) {
        handleValidateId();
      }
    };

    socket.on('driver:approved', handleApproved);
    return () => socket.off('driver:approved', handleApproved);
  }, [step, vehicleId]);

  // ── Auth: Step 1 — validate Vehicle ID ─────────────────────
  const handleValidateId = async () => {
    if (!vehicleId.trim()) return;
    setBusy(true); setError('');
    try {
      await api.validateVehicleId(vehicleId.trim().toUpperCase());
      setStep('pin');
      setTimeout(() => pinInputRef.current?.focus(), 200);
    } catch (err) {
      setError(err.status === 404 ? t.errInvalidId : err.status === 403 ? (err.data?.message || err.message || 'Your registration is pending admin approval.') : t.errServer);
    } finally { setBusy(false); }
  };

  // ── Auth: Step 2 — verify PIN ───────────────────────────────
  const handleLogin = async () => {
    if (pin.length !== 4) return;
    setBusy(true); setError('');
    try {
      const { driver: d, token } = await api.driverLogin(vehicleId.trim().toUpperCase(), pin);
      setDriverSession(d, token);
      setDriver(d);

      const socket = connectSocket();
      const driverId = d.id || d._id;

      const handleReconnect = () => {
        socket.emit('driver:register', { driverId, vehicleType: d.vehicleType, token });
        setSocketConnected(true);
      };

      if (socket.connected) setSocketConnected(true);

      socket.off('driver:kicked');
      // FIX #11 (login path): Re-register on every reconnect
      socket.on('connect', handleReconnect);
      socket.on('disconnect', () => setSocketConnected(false));

      socket.on('driver:kicked', ({ reason }) => {
        unwatchRef.current?.();
        clearInterval(pingRef.current);
        disconnectSocket();
        clearDriverSession();
        setDriver(null);
        setOnDuty(false);
        setStep('id');
        setKickedMsg(reason || 'Your account has been removed by admin.');
      });

      setStep('panel');
      setPin('');
    } catch (err) {
      setError(err.status === 401 ? t.errWrongPin : t.errServer);
      setPin('');
    } finally { setBusy(false); }
  };

  const startTracking = () => {
    const socket = connectSocket();
    const d = driverRef.current;
    const driverId = d?.id || d?._id;
    const vehicleType = d?.vehicleType;
    const token = getDriverToken();

    if (socket.connected) {
      socket.emit('driver:register', { driverId, vehicleType, token });
    } else {
      socket.once('connect', () => socket.emit('driver:register', { driverId, vehicleType, token }));
    }

    const basePayload = {
      driverId,
      vehicleId:     d?.vehicleId,
      type:          d?.vehicleType,
      vehicleNumber: d?.vehicleNumber,
      busName:       d?.busName     || '',
      routeFrom:     d?.routeFrom   || '',
      routeTo:       d?.routeTo     || '',
      routeNumber:   d?.routeNumber || '',
      capacity:      d?.vehicleType === 'bus' ? 60 : 1,
    };

    if (unwatchRef.current) unwatchRef.current();
    setGpsError(false);
    setGpsStale(false);
    setMaxAttemptsReached(false);
    lastGpsUpdateRef.current = Date.now();

    unwatchRef.current = watchPosition(pos => {
      setGpsPos(pos);
      setGpsError(false);
      setGpsStale(false);
      gpsPosRef.current = pos;
      lastGpsUpdateRef.current = Date.now();
      reconnectAttemptsRef.current = 0; // ✅ Reset attempts on successful signal
      setSpeed(Math.round((pos.speed || 0) * 3.6));
      
      // FIX: Only emit if significantly moved or 5s passed
      const now = Date.now();
      // Track movement for health check (threshold: ~1 km/h)
      if ((pos.speed || 0) > 0.3) {
        lastMovementRef.current = now;
        healthAlertSentRef.current = false;
      }

      if (now - lastEmitRef.current > 5000) {
        lastEmitRef.current = now;
        const d = driverRef.current;
        emitLocation({
          driverId:      d?.id || d?._id,
          vehicleId:     d?.vehicleId,
          type:          d?.vehicleType,
          vehicleNumber: d?.vehicleNumber,
          busName:       d?.busName     || '',
          routeFrom:     d?.routeFrom   || '',
          routeTo:       d?.routeTo     || '',
          routeNumber:   d?.routeNumber || '',
          capacity:      d?.vehicleType === 'bus' ? 60 : 1,
          lat: pos.lat, lng: pos.lng,
          bearing: pos.bearing || 0,
          speed: Math.round((pos.speed || 0) * 3.6),
          status: activeRideRef.current ? 'busy' : 'active',
          passengers: passengersRef.current,
        });
      }
    }, () => {
      setGpsError(true);
    });

    if (pingRef.current) clearInterval(pingRef.current);
    pingRef.current = setInterval(() => {
      const pos = gpsPosRef.current;
      if (pos) emitLocation({
        ...basePayload,
        lat: pos.lat, lng: pos.lng,
        status: activeRideRef.current ? 'busy' : 'active',
      });

      // ✅ GPS Signal Check: Warning after 60s of no updates
      const now = Date.now();
      if (now - lastGpsUpdateRef.current > 60000) {
        setGpsStale(true);
      } else {
        setGpsStale(false);
      }

      // ✅ AUTO-RECONNECT: Restart tracking if GPS is stale for 3 minutes (180s)
      if (now - lastGpsUpdateRef.current > 180000) {
        if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
          reconnectAttemptsRef.current += 1;
          console.log(`[Auto-Reconnect] Attempt ${reconnectAttemptsRef.current}/${MAX_RECONNECT_ATTEMPTS}. GPS stale for 3 mins. Restarting tracking...`);
          startTracking();
        } else {
          console.warn('[Auto-Reconnect] Max attempts reached. GPS remains disabled/stale.');
          setMaxAttemptsReached(true);
          // ✅ Operational Monitoring: Log the failure to the backend
          const token = getDriverToken();
          if (token) {
            api.logDriverEvent({
              event: 'MAX_RECONNECT_REACHED',
              details: { lastGpsUpdate: new Date(lastGpsUpdateRef.current).toISOString() }
            }, token).catch(() => {});
          }
          setGpsError(true);
          setGpsStale(false);
          if (unwatchRef.current) unwatchRef.current();
        }
        return;
      }

      // ✅ RIDE HEALTH CHECK: Automated ping if stationary for 5 minutes OR GPS lost for 2 minutes
      if (activeRideRef.current && activeRideRef.current.status === 'started' && !healthAlertSentRef.current) {
        const isStationary = now - lastMovementRef.current > 300000; // 5 mins
        const isGpsLost    = now - lastGpsUpdateRef.current > 120000; // 2 mins

        if (isStationary || isGpsLost) {
          const s = getSocket();
          if (s.connected) {
            s.emit('ride:healthAlert', {
              bookingId: activeRideRef.current.id,
              driverId: driverRef.current?.id || driverRef.current?._id,
              reason: isGpsLost ? 'GPS_LOST' : 'STATIONARY'
            });
            healthAlertSentRef.current = true;
            console.warn(`[HealthCheck] ${isGpsLost ? 'GPS Lost' : 'Stationary'} alert sent to backend`);
          }
        }
      }
    }, 10000);
  };

  // ── Panel: start duty ───────────────────────────────────────
  const startDuty = async () => {
    // FIX #13: Call API first — only set state on success.
    try {
      await api.setDriverDuty(true, getDriverToken());
    } catch {
      alert('Failed to start duty. Please check your connection and try again.');
      return;
    }
    setOnDuty(true);
    speak(t.gpsActive, lang);
    reconnectAttemptsRef.current = 0; // Reset on manual duty start
    startTracking();
  };

  const handleRetryGps = () => {
    if (!onDuty) return;
    playPop();
    window.navigator?.vibrate?.(10);
    reconnectAttemptsRef.current = 0; // Reset on manual retry
    startTracking();
  };

  // ── Panel: end duty ─────────────────────────────────────────
  const endDuty = async () => {
    if (activeRide || rideReq) {
      alert(activeRide 
        ? 'Please complete or cancel the active ride before going off duty.' 
        : 'Please respond to the pending ride request first.');
      return;
    }
    if (!window.confirm(t.confirmEnd)) return;
    unwatchRef.current?.(); unwatchRef.current = null;
    clearInterval(pingRef.current); pingRef.current = null;
    gpsPosRef.current = null;
    setOnDuty(false); setGpsPos(null); setSpeed(0);
    setTripActive(false); setRideReq(null); setActiveRide(null); setUserLocation(null);
    setMaxAttemptsReached(false);
    clearActiveDriverRide();
    lastEmitRef.current = 0;
    try { await api.setDriverDuty(false, getDriverToken()); } catch {}
    disconnectSocket();
  };

  // ── Listen for ride requests ────────────────────────────────
  useEffect(() => {
    if (!onDuty) return;
    const unsub = onRideRequest(req => {
      // Suppress new ride requests if driver already has an active ride
      const currentRide = activeRideRef.current;
      if (currentRide && ['accepted', 'started'].includes(currentRide.status)) return;

      setRideReq(req);
      speak(
        lang === 'hi' ? 'नई बुकिंग आई है।' :
        lang === 'or' ? 'ନୂଆ ବୁକିଂ ଆସିଛି।' :
        'New ride request.',
        lang,
      );
    });
    return unsub;
  }, [onDuty, lang]); // activeRide removed from deps as we use Ref inside callback

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    // ── BUG FIX A ───────────────────────────────────────────────
    // Rider location handler — unchanged, just made explicit
    const handleRiderLocation = ({ bookingId, lat, lng, bearing, speed }) => {
      const currentRide = activeRideRef.current;
      if (!currentRide) return;
      // Compare both as strings — activeRide.id comes from rideReq.id
      // which is the MongoDB _id cast through JSON, always a string.
      if (String(bookingId) !== String(currentRide.id)) return;
      setUserLocation({ lat, lng, bearing, speed });
      setSocketDebug(d => [...d.slice(-9), {
        t: Date.now(), e: 'rider:locationUpdate',
        d: { bookingId, lat, lng, bearing, speed },
      }]);
    };

    // ── BUG FIX B ───────────────────────────────────────────────
    // The old handler only listened on 'booking:cancelled' which is
    // the event emitted to driver:${driverId} room when rider cancels
    // an ACCEPTED ride. But:
    //   1. The event payload has { bookingId, action } — the old code
    //      destructured only { bookingId } which is fine.
    //   2. When booking is in 'searching' state, driverId is null on
    //      the booking, so the old bookings.js never emitted to the
    //      driver room at all. We've now fixed bookings.js to emit
    //      'ride:cancelled' (broadcast) for searching-state cancels.
    //      This handler picks that up.
    const handleBookingCancelled = ({ bookingId }) => {
      const currentRide = activeRideRef.current;
      if (!currentRide || !bookingId) return;
      if (String(bookingId) !== String(currentRide.id)) return;
      clearActiveDriverRide();
      setActiveRide(null);
      setTripActive(false);
      setUserLocation(null);
      setPassengers(0);
      setSocketDebug(d => [...d.slice(-9), {
        t: Date.now(), e: 'booking:cancelled', d: { bookingId },
      }]);
      speak(
        lang === 'hi' ? 'यात्री ने राइड रद्द की।' :
        lang === 'or' ? 'ଯାତ୍ରୀ ରାଇଡ ବାତିଲ କଲେ।' :
        'Passenger cancelled the ride.',
        lang,
      );
      alert('Passenger cancelled the booking.');
    };

    // ── BUG FIX C ───────────────────────────────────────────────
    // Handle rider cancellation DURING searching phase.
    // The fixed bookings.js now emits 'ride:cancelled' (broadcast)
    // when no driver is assigned yet. This dismisses the ride request
    // card so the driver doesn't try to accept an already cancelled ride.
    const handleRideCancelled = ({ bookingId, id }) => {
      const cancelledId = bookingId || id;
      if (!cancelledId) return;
      // Dismiss pending ride request if it matches
      setRideReq(prev => {
        if (prev && String(prev.id) === String(cancelledId)) {
          setSocketDebug(d => [...d.slice(-9), {
            t: Date.now(), e: 'ride:cancelled (search phase)', d: { cancelledId },
          }]);
          return null; // dismiss the request card
        }
        return prev;
      });
      // Also clear active ride if driver somehow accepted it simultaneously
      setActiveRide(prev => { // FIX: Clear active ride if it matches the cancelled ID
        if (prev && String(prev.id) === String(cancelledId)) {
          setTripActive(false);
          setUserLocation(null);
          setPassengers(0);
          clearActiveDriverRide();
          return null;
        }
        return prev;
      });
    };

    const handleRiderNotification = (data) => {
      setSocketDebug(d => [...d.slice(-9), {
        t: Date.now(), e: 'rider:notification', d: data
      }]);
      
      if (data.message) {
        if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
        setToast(data.message);
        speak(data.message, lang);
        window.navigator?.vibrate?.([100, 50, 100]);
        toastTimeoutRef.current = setTimeout(() => setToast(null), 6000);
      }
    };

    socket.on('rider:locationUpdate', handleRiderLocation);
    socket.on('booking:cancelled',    handleBookingCancelled);
    socket.on('ride:cancelled',       handleRideCancelled);
    socket.on('rider:notification',    handleRiderNotification);

    return () => {
      socket.off('rider:locationUpdate', handleRiderLocation);
      socket.off('booking:cancelled',    handleBookingCancelled);
      socket.off('ride:cancelled',       handleRideCancelled);
      socket.off('rider:notification',    handleRiderNotification);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRide, lang]);

  // ── Accept ride ─────────────────────────────────────────────
  // ✅ FIXED: Only the HTTP call is made here.
  // The backend route handles emitting the socket event WITH full driver
  // details to the booking room. The old emitRideResponse() socket call
  // was firing simultaneously and overwriting the driver info with { action }
  // only — that was the race condition causing the 60s wait on the rider side.
  const acceptRide = async () => {
    if (!rideReq || busy) return; 
    setBusy(true); // Prevent double-taps
    try {
      await api.respondToRide(rideReq.id, 'accept', getDriverToken());
      // ✅ Driver accepted the booking, but pickup hasn't happened yet.
      const acceptedRide = { ...rideReq, id: rideReq.id, status: 'accepted' };
      setActiveRide(acceptedRide);
      setActiveDriverRide(acceptedRide);
      joinBookingRoom(rideReq.id);
      setRideReq(null);
      setUserLocation(null);
      setTripActive(false);
      speak(
        lang === 'hi' ? 'बुकिंग स्वीकार।' :
        lang === 'or' ? 'ବୁକିଂ ଗ୍ରହଣ।' :
        'Ride accepted.',
        lang,
      );
    } catch (err) {
      console.error('[Driver] Failed to accept ride:', err);
      setRideReq(null); // FIX: Clear stale request if it's no longer valid
      alert('Failed to accept ride. It may have been taken or cancelled.');
    } finally {
      setBusy(false); // FIX: Must reset busy state to allow future actions
    }
  };

  // ── Decline ride ────────────────────────────────────────────
  // ✅ FIXED: Same fix — HTTP only, no redundant socket emit
  const declineRide = async () => {
    if (!rideReq || busy) return;
    setBusy(true);
    try {
      await api.respondToRide(rideReq.id, 'decline', getDriverToken());
      // ✅ DO NOT call emitRideResponse here — backend handles socket emit
      setRideReq(null);
    } catch (err) {
      console.error('[Driver] Failed to decline ride:', err);
      setRideReq(null); // dismiss UI even on error
    } finally { setBusy(false); }
  };

  const startRide = async () => {
    if (!activeRide || busy) return;
    
    setBusy(true);
    try {
      // OTP is now passed as a dummy value "0000" because the backend no longer requires it
      await api.startRide(activeRide.id, "0000", getDriverToken());
      
      // FIX: Only update local state AFTER successful backend verification
      const startedRide = { ...activeRide, status: 'started' };
      setTripActive(true);
      lastMovementRef.current = Date.now(); // Reset movement timer when trip starts
      lastGpsUpdateRef.current = Date.now(); // Reset GPS timer
      healthAlertSentRef.current = false;
      setActiveRide(startedRide);
      setActiveDriverRide(startedRide);
      setPassengers(prev => prev + 1);
      speak(
        lang === 'hi' ? 'यात्रा शुरू।' :
        lang === 'or' ? 'ଯାତ୍ରା ଆରମ୍ଭ।' :
        'Trip started.',
        lang,
      );
    } catch (err) {
      console.error('[Driver] Failed to start ride:', err);
      // FIX #14: Handle stale ride (404/409) by clearing local state.
      // "Failed to start the ride" was caused by a stale localStorage ride
      // that no longer exists in DB. Now we clear it and show a clear message
      // so driver can receive new rides instead of being stuck.
      if (err.status === 404 || err.status === 409 || err.status === 403) {
        clearActiveDriverRide();
        setActiveRide(null);
        setTripActive(false);
        setUserLocation(null);
        setPassengers(0);
        const msg =
          err.status === 403 ? 'This ride is not assigned to you.' :
          err.status === 409 ? 'This ride has already been started or cancelled.' :
          'This ride is no longer available — the passenger may have cancelled.';
        alert(msg);
      } else {
        alert('Failed to start the ride. Please check your connection and try again.');
      }
    } finally {
      setBusy(false);
    }
  };

  const completeRide = async () => {
    if (!activeRide || busy) return;
    setBusy(true);
    // ── BUG FIX E ───────────────────────────────────────────────
    // Capture bookingId before state is cleared. The HTTP PUT /:id/complete
    // route already emits 'completed' to the rider. The socket.emit('trip:ended')
    // that was here previously would trigger index.js trip:ended handler which
    // NOW also emits 'completed' to the rider — causing a double-fire.
    // Removed it. HTTP is the single source of truth for ride completion.
    const bookingId = activeRide.id;
    const fareAmount = activeRide.fareAmount;
    try {
      const result = await api.completeRide(bookingId, getDriverToken());
      setTripActive(false);
      setTripCount(c => c + 1);
      setEarnings(e => e + (result.fareAmount || fareAmount || 120));
      setActiveRide(null);
      clearActiveDriverRide();
      setUserLocation(null);
      setPassengers(0);
      // No socket.emit('trip:ended') — HTTP route handles rider notification.
      speak(
        lang === 'hi' ? 'यात्रा खत्म।' :
        lang === 'or' ? 'ଯାତ୍ରା ଶେଷ।' :
        'Trip ended.',
        lang,
      );
    } catch (err) {
      console.error('[Driver] Failed to complete ride:', err);
      alert('Failed to complete the ride. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const cancelActiveRide = async () => {
    if (!activeRide || busy) return;
    setBusy(true);
    // ── BUG FIX D ───────────────────────────────────────────────
    // Capture bookingId BEFORE clearing state — the HTTP PUT /:id/cancel
    // route emits booking:cancelled to the rider's booking room and
    // the global fallback broadcast. We don't need to emit trip:ended
    // via socket here — that was redundant and created a double-notify
    // race condition where the socket event arrived before HTTP finished.
    const bookingId = activeRide.id;
    try {
      await api.cancelRide(bookingId, getDriverToken());
      // HTTP succeeded — rider has already been notified by the backend.
      // Now clear local driver state.
      setTripActive(false);
      setActiveRide(null);
      clearActiveDriverRide();
      setUserLocation(null);
      setPassengers(0);
      // No socket.emit('trip:ended') here — HTTP route handles rider notify.
      speak(
        lang === 'hi' ? 'राइड रद्द कर दी गई।' :
        lang === 'or' ? 'ରାଇଡ୍ ବାତିଲ ହେଲା।' :
        'Ride cancelled.',
        lang,
      );
    } catch (err) {
      console.error('[Driver] Failed to cancel active ride:', err);
      // FIX: Handle stale/already-cancelled rides gracefully by clearing local state
      if (err.status === 404 || err.status === 409 || err.status === 403) {
        setTripActive(false);
        setActiveRide(null);
        clearActiveDriverRide();
        setUserLocation(null);
        setPassengers(0);
        alert(err.message || 'This ride is no longer available.');
      } else {
        alert('Failed to cancel the ride. Please check your connection and try again.');
      }
    } finally {
      setBusy(false);
    }
  };

  // ── SOS ─────────────────────────────────────────────────────
  const handleSOS = () => {
    if (!window.confirm(t.confirmSos)) return;
    const pos = gpsPosRef.current;
    if (pos) emitLocation({
      driverId: driver?.id || driver?._id,
      vehicleId: driver?.vehicleId,
      lat: pos.lat, lng: pos.lng,
      status: 'SOS',
    });
    window.open('tel:+917328060281');
  };

  // ── Sign out ─────────────────────────────────────────────────
  const signOut = async () => {
    if (onDuty) await endDuty();
    clearDriverSession();
    clearActiveDriverRide();
    setDriver(null);
    setStep('id');
    setVehicleId('');
    setKickedMsg('');
    const socket = getSocket();
    socket?.off('driver:kicked');
  };

  useEffect(() => () => { unwatchRef.current?.(); clearInterval(pingRef.current); }, []);

  // ── Render: Step 1 — Vehicle ID ─────────────────────────────
  if (step === 'id') return (
    <div className="app">
      <Header title={t.step1Title} showBack onBack={() => navigate(-1)} />
      <div className="drv-auth-page page">
        <div className="drv-auth-lang">
          {(['en','hi','or']).map(l => (
            <button key={l} className={`drv-auth-lang-btn ${lang===l?'active':''}`} onClick={() => setLang(l)}>
              {T[l].lang}
            </button>
          ))}
        </div>

        <div className="drv-auth-box card">
          <div className="drv-auth-icon"><SteeringIcon /></div>
          <h2 className="drv-auth-title">{t.step1Title}</h2>
          <p className="drv-auth-sub">{t.step1Sub}</p>

          {kickedMsg && (
            <div style={{
              background: '#FEE2E2', color: '#B91C1C',
              borderRadius: 8, padding: '10px 14px',
              fontSize: 13, marginBottom: 12, textAlign: 'center',
            }}>
              ⚠️ {kickedMsg}
            </div>
          )}

          <div className="drv-auth-field">
            <label className="drv-auth-label">{t.vehicleIdLabel}</label>
            <input
              className="input"
              value={vehicleId}
              onChange={e => { setVehicleId(e.target.value.toUpperCase()); setError(''); }}
              placeholder={t.vehicleIdPh}
              onKeyDown={e => e.key === 'Enter' && handleValidateId()}
              autoFocus
              autoComplete="off"
              spellCheck={false}
            />
          </div>

          {error && <p className="drv-auth-error">{error}</p>}

          <button className="btn btn--primary btn--full btn--lg" onClick={handleValidateId}
            disabled={!vehicleId.trim() || busy}>
            {busy ? <><span className="spinner" style={{width:14,height:14,borderWidth:2}}/>{t.validating}</> : t.next}
          </button>
        </div>

        <p className="drv-auth-note">Vehicle IDs are assigned by MoveOn Go admin. Contact +91 73280 60281 for registration.</p>
      </div>
    </div>
  );

  // Debug panel for driver
  const DebugPanel = () => (
    <div style={{ position: 'fixed', right: 8, bottom: 8, zIndex: 1000, background: 'rgba(0,0,0,0.6)', color: '#fff', padding: 8, borderRadius: 6, fontSize: 12, maxWidth: 360 }}>
      <div style={{ fontWeight: 'bold', marginBottom: 6 }}>Driver Socket Debug</div>
      <div style={{ maxHeight: 160, overflow: 'auto' }}>
        {socketDebug.length === 0 ? <div>- no events -</div> : socketDebug.slice().reverse().map((x, i) => (
          <div key={i} style={{ marginBottom: 6 }}>
            <div style={{ opacity: .8 }}>{new Date(x.t).toLocaleTimeString()} · {x.e}</div>
            <pre style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{JSON.stringify(x.d, null, 2)}</pre>
          </div>
        ))}
      </div>
    </div>
  );

  // ── Render: Step 2 — PIN ────────────────────────────────────
  if (step === 'pin') return (
    <div className="app">
      <Header title={t.step2Title} showBack onBack={() => { setStep('id'); setError(''); setPin(''); }} />
      <div className="drv-auth-page page">
        <div className="drv-auth-lang">
          {(['en','hi','or']).map(l => (
            <button key={l} className={`drv-auth-lang-btn ${lang===l?'active':''}`} onClick={() => setLang(l)}>
              {T[l].lang}
            </button>
          ))}
        </div>

        <div className="drv-auth-box card">
          <div className="drv-auth-icon"><LockIcon /></div>
          <h2 className="drv-auth-title">{t.step2Title}</h2>
          <p className="drv-auth-sub">{t.step2Sub}</p>
          <p className="drv-auth-vehicle-id">{vehicleId}</p>

          <div className="drv-pin-dots">
            {[0,1,2,3].map(i => (
              <div key={i} className={`drv-pin-dot ${pin.length > i ? 'filled' : ''}`} />
            ))}
          </div>

          <input
            ref={pinInputRef}
            className="drv-pin-hidden-input"
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={4}
            value={pin}
            onChange={e => { const v = e.target.value.replace(/\D/g,'').slice(0,4); setPin(v); setError(''); }}
            onKeyDown={e => e.key === 'Enter' && pin.length === 4 && handleLogin()}
            autoComplete="one-time-code"
          />

          <div className="drv-numpad">
            {[1,2,3,4,5,6,7,8,9,'',0,'⌫'].map((k, i) => (
              <button key={i} className={`drv-numpad-key ${k===''?'drv-numpad-key--empty':''}`}
                disabled={k === ''}
                onClick={() => {
                  if (k === '⌫') { setPin(p => p.slice(0,-1)); setError(''); }
                  else if (pin.length < 4) setPin(p => p + String(k));
                }}>
                {k}
              </button>
            ))}
          </div>

          {error && <p className="drv-auth-error">{error}</p>}

          <button className="btn btn--primary btn--full btn--lg" onClick={handleLogin}
            disabled={pin.length !== 4 || busy} style={{marginTop:8}}>
            {busy ? <><span className="spinner" style={{width:14,height:14,borderWidth:2}}/>{t.signing}</> : t.signIn}
          </button>
        </div>
      </div>
    </div>
  );

  // ── Render: Panel ───────────────────────────────────────────
  return (
    <div className="app">
      <Header title={t.step1Title} showBack onBack={() => {}} />
      <div className="page drv-panel">

        <div className="drv-lang-row">
          {(['en','hi','or']).map(l => (
            <button key={l} className={`drv-auth-lang-btn ${lang===l?'active':''}`} onClick={() => setLang(l)}>
              {T[l].lang}
            </button>
          ))}
          <div style={{flex:1}}/>
          <button className="btn btn--ghost" style={{fontSize:12,padding:'4px 10px'}} onClick={signOut}>
            {t.signOut}
          </button>
        </div>

        <div className={`drv-status-card ${onDuty ? 'on' : 'off'}`}>
          <div className="drv-status-card__left">
            <div className="drv-status-card__avatar">{driver?.name?.[0] || 'D'}</div>
            <div>
              <div className="drv-status-card__name">{driver?.name || 'Driver'}</div>
              <div className="drv-status-card__id">{driver?.vehicleId || vehicleId}</div>
            </div>
            {onDuty && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                <div style={{ 
                  width: 6, height: 6, borderRadius: '50%', 
                  background: socketConnected ? 'var(--green-600)' : 'var(--danger)',
                  boxShadow: socketConnected ? '0 0 6px var(--green-600)' : 'none'
                }} />
                <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--gray-500)', letterSpacing: '0.4px' }}>
                  {socketConnected ? 'SERVER CONNECTED' : 'SERVER DISCONNECTED'}
                </span>
              </div>
            )}
          </div>
          <div className={`drv-status-badge ${onDuty ? 'on' : 'off'}`}>
            {onDuty && <span className="live-dot" style={{width:7,height:7,background:'white'}}/>}
            {onDuty ? t.onDuty : t.offDuty}
          </div>
        </div>

        {onDuty && (
          <div className="drv-stats">
            {[
              {val: speed,          unit: 'km/h', label: t.speed     },
              {val: tripCount,      unit: '',     label: t.trips     },
              {val: `₹${earnings}`, unit: '',     label: t.earned    },
              {val: passengers,     unit: '',     label: t.passengers},
            ].map((s,i) => (
              <div key={i} className="drv-stat">
                <span className="drv-stat__val">{s.val}<span className="drv-stat__unit">{s.unit}</span></span>
                <span className="drv-stat__key">{s.label}</span>
              </div>
            ))}
          </div>
        )}

        {onDuty && (
          <div 
            className={`drv-gps-bar ${gpsError ? 'drv-gps-bar--error' : gpsStale ? 'drv-gps-bar--warning' : ''}`}
            style={gpsStale && !gpsError ? { background: '#EAB308', color: 'white' } : {}}
          >
            <span className="live-dot" style={{width:7,height:7, background: (gpsError || gpsStale) ? 'white' : undefined}}/>
            <span style={{flex: 1}}>
              {gpsError ? 'GPS Error — check permissions' : 
               gpsStale ? 'GPS Signal Stale — checking connection...' : 
               t.gpsActive}
            </span>
            {(gpsError || gpsStale) && (
              <button 
                className="btn btn--ghost" 
                style={{fontSize:10, padding: '4px 10px', height: 'auto', border: '1px solid white', color: 'white'}}
                onClick={handleRetryGps}
              >
                Retry GPS
              </button>
            )}
            {!gpsError && !gpsStale && gpsPos && <span className="drv-gps-coords">{gpsPos.lat.toFixed(4)}, {gpsPos.lng.toFixed(4)}</span>}
          </div>
        )}

        {onDuty && maxAttemptsReached && (
          <div style={{padding: '0 16px', marginTop: 8}}>
            <button 
              className="btn btn--danger btn--full" 
              style={{height: 40, fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8}}
              onClick={() => window.open('tel:+917328060281')}
            >
              <PhoneIcon /> {t.techSupport}
            </button>
          </div>
        )}

        {activeRide && (
          <div className="drv-combined-ride-area">
          <div className="drv-active-ride-card card" style={{margin:'12px 16px',padding:'16px'}}>
            {!tripActive && activeRide.pickupLat && activeRide.pickupLng && (
              <button 
                className="btn btn--secondary btn--full" 
                style={{marginBottom: 12, height: 44, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8}}
                onClick={() => window.open(`https://www.openstreetmap.org/?mlat=${activeRide.pickupLat}&mlon=${activeRide.pickupLng}#map=17/${activeRide.pickupLat}/${activeRide.pickupLng}`, '_blank')}
              >
                🗺️ {t.navigate}
              </button>
            )}
            {tripActive && activeRide.dropoffLat && activeRide.dropoffLng && (
              <button 
                className="btn btn--secondary btn--full" 
                style={{marginBottom: 12, height: 44, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8}}
                onClick={() => window.open(`https://www.openstreetmap.org/?mlat=${activeRide.dropoffLat}&mlon=${activeRide.dropoffLng}#map=17/${activeRide.dropoffLat}/${activeRide.dropoffLng}`, '_blank')}
              >
                🏁 {t.navigateDrop}
              </button>
            )}
             {activeRide.payment === 'Cash' && tripActive && (
               <button 
                 className="btn btn--success btn--full" 
                 style={{marginTop: 16, height: 48, fontWeight: 700, fontSize: 14}}
                 onClick={(e) => { e.target.disabled = true; e.target.innerText = `✅ ${t.cashReceived}`; alert(t.confirmCash); }}
               >
                 💵 {t.cashReceived}
               </button>
             )}
          </div>
          <div className="drv-user-location-card card" style={{margin:'0 16px 16px',padding:'12px 14px'}}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
              <div>
                <div style={{fontSize: 11, color: 'var(--gray-400)', fontWeight: 700, textTransform: 'uppercase'}}>Passenger Status</div>
                <div style={{fontSize: 14, fontWeight: 600, color: 'var(--gray-900)', marginTop: 2}}>
                  {userLocation ? '🟢 Live location active' : '⚪ Waiting for GPS signal'}
                </div>
              </div>
              {userLocation && (
                <div className="badge badge--green">
                  <span className="live-dot" style={{width:6, height:6, background: 'white'}} />
                  CONNECTED
                </div>
              )}
            </div>
          </div>
          </div>
        )}

        <div className="drv-main-action">
          {!onDuty ? (
            <button className="drv-duty-btn start" onClick={startDuty}>{t.startDuty}</button>
          ) : activeRide ? (
            tripActive ? (
              <button className="drv-duty-btn end-trip" onClick={completeRide}>{t.endTrip}</button>
            ) : (
              <div style={{display:'flex',gap:12}}>
                <button className="drv-duty-btn start" style={{flex:1}} onClick={startRide}>{t.startTrip}</button>
                <button className="drv-duty-btn end-duty" style={{flex:1}} onClick={cancelActiveRide}>{t.cancelRide}</button>
              </div>
            )
          ) : (
            <button className="drv-duty-btn end-duty" onClick={endDuty}>{t.endDuty}</button>
          )}
        </div>

        {onDuty && activeRide && (
          <div className="drv-debug-panel card" style={{margin:'0 16px 16px',padding:'14px',background:'rgba(255,255,255,0.08)',border:'1px solid rgba(255,255,255,0.08)'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
              <div style={{fontSize:13,fontWeight:700}}>Driver debug controls</div>
              <span style={{fontSize:12,color:'var(--gray-400)'}}>{activeRide.status?.toUpperCase() || 'N/A'}</span>
            </div>
            <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
              {!tripActive && (
                <button className="btn btn--primary" style={{flex:1,minWidth:120}} onClick={startRide}>
                  Start trip
                </button>
              )}
              {tripActive && (
                <button className="btn btn--success" style={{flex:1,minWidth:120}} onClick={completeRide}>
                  Complete trip
                </button>
              )}
              <button className="btn btn--danger" style={{flex:1,minWidth:120}} onClick={cancelActiveRide}>
                Cancel ride
              </button>
            </div>
          </div>
        )}

        {/* ✅ BUS UTILITY: Manual passenger counter for bus operators */}
        {onDuty && driver?.vehicleType === 'bus' && (
          <div style={{padding:'0 16px', marginTop: 12}}>
            <div className="card" style={{padding: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
              <div>
                <div style={{fontSize: 13, fontWeight: 700, color: 'var(--gray-900)'}}>Passenger Load</div>
                <div style={{fontSize: 12, color: 'var(--gray-400)'}}>Update count for riders</div>
              </div>
              <div style={{display: 'flex', alignItems: 'center', gap: 16}}>
                <button 
                  className="btn btn--secondary" 
                  style={{width: 40, height: 40, borderRadius: '50%', padding: 0}}
                  onClick={() => setPassengers(p => Math.max(0, p - 5))}
                >—</button>
                <strong style={{fontSize: 20, minWidth: 30, textAlign: 'center'}}>{passengers}</strong>
                <button 
                  className="btn btn--secondary" 
                  style={{width: 40, height: 40, borderRadius: '50%', padding: 0}}
                  onClick={() => setPassengers(p => Math.min(60, p + 5))}
                >+</button>
              </div>
            </div>
          </div>
        )}

        {onDuty && (
          <div className="drv-actions">
            <button className="drv-action-btn" onClick={() => alert('Feature integration: This would open a live QR scanner to follow the passenger tracking link.')}>
              <QrIcon /><span>{t.scanQr}</span>
            </button>
            <button className="drv-action-btn" onClick={() => setIssueSheet(true)}>
              <WarningIcon /><span>{t.reportIssue}</span>
            </button>
            <button className="drv-action-btn" onClick={() => window.open('tel:+917328060281')}>
              <PhoneIcon /><span>{t.callControl}</span>
            </button>
            <button className="drv-action-btn drv-action-btn--sos" onClick={handleSOS}>
              <SosIcon /><span>{t.sos}</span>
            </button>
          </div>
        )}

        {onDuty && (
          <div style={{padding:'0 16px'}}>
            <p className="section-label" style={{padding:'16px 0 8px'}}>{t.todaySummary}</p>
            <div className="card">
              {[
                {label: t.trips,      val: tripCount},
                {label: t.earned,     val: `₹${earnings}`},
                {label: t.passengers, val: passengers},
              ].map((r,i,arr) => (
                <div key={i}>
                  <div className="drv-sum-row">
                    <span className="drv-sum-label">{r.label}</span>
                    <span className="drv-sum-val">{r.val}</span>
                  </div>
                  {i < arr.length-1 && <div className="divider"/>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Rider Notification Toast */}
      {toast && (
        <div className="slide-up" style={{
          position: 'fixed', top: 20, left: 16, right: 16, zIndex: 10000,
          background: 'rgba(13, 71, 161, 0.95)', color: 'white',
          padding: '12px 16px', borderRadius: 12, display: 'flex', 
          alignItems: 'center', gap: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
          backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.1)'
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: '50%', background: 'rgba(255,255,255,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18
          }}>🔔</div>
          <div style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>{toast}</div>
          <button 
            onClick={() => setToast(null)}
            style={{
              background: 'none', border: 'none', color: 'white', 
              opacity: 0.7, padding: 4, cursor: 'pointer', display: 'flex'
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>
      )}

      <DebugPanel />

      {rideReq && (
        <>
          <div className="overlay" onClick={() => {}} />
          <div className="drv-ride-sheet slide-up">
            <div className="drv-ride-sheet__handle" />
            <div className="drv-ride-sheet__header">
              <div className="drv-ride-sheet__pulse">
                <div className="drv-ride-sheet__pulse-ring" />
                <span className="drv-ride-sheet__bell">🔔</span>
              </div>
              <div>
                <div className="drv-ride-sheet__title">{t.newRide}</div>
                <div className="drv-ride-sheet__sub">Respond within 30 seconds</div>
              </div>
            </div>
            <div className="drv-ride-sheet__body">
              <div className="drv-ride-row">
                <div className="drv-ride-dot drv-ride-dot--green"/>
                <div>
                  <div className="drv-ride-row__label">{t.from}</div>
                  <div className="drv-ride-row__val">{rideReq.pickup}</div>
                  {rideReq.pickupLat && rideReq.pickupLng && (
                    <div className="drv-ride-row__coord">{rideReq.pickupLat.toFixed(4)}, {rideReq.pickupLng.toFixed(4)}</div>
                  )}
                </div>
              </div>
              <div className="drv-ride-connector"/>
              <div className="drv-ride-row">
                <div className="drv-ride-dot drv-ride-dot--red"/>
                <div>
                  <div className="drv-ride-row__label">{t.to}</div>
                  <div className="drv-ride-row__val">{rideReq.dropoff}</div>
                  {rideReq.dropoffLat && rideReq.dropoffLng && (
                    <div className="drv-ride-row__coord">{rideReq.dropoffLat.toFixed(4)}, {rideReq.dropoffLng.toFixed(4)}</div>
                  )}
                </div>
              </div>
              <div className="drv-ride-meta">
                <div className="drv-ride-chip">
                  <span className="drv-ride-chip__label">{t.fare}</span>
                  <span className="drv-ride-chip__val green">{rideReq.fare || '₹--'}</span>
                </div>
                <div className="drv-ride-chip">
                  <span className="drv-ride-chip__label">{t.distance}</span>
                  <span className="drv-ride-chip__val">{rideReq.distance || '--'}</span>
                </div>
                <div className="drv-ride-chip">
                  <span className="drv-ride-chip__label">{t.eta}</span>
                  <span className="drv-ride-chip__val">{rideReq.eta || '--'}</span>
                </div>
              </div>
            </div>
            <div className="drv-ride-sheet__actions">
              <button className="btn btn--danger btn--lg" style={{flex:1}} onClick={declineRide}>{t.decline}</button>
              <button className="btn btn--primary btn--lg" style={{flex:1,background:'var(--green-600)'}} onClick={acceptRide}>{t.accept}</button>
            </div>
          </div>
        </>
      )}

      {issueSheet && (
        <>
          <div className="overlay" onClick={() => setIssueSheet(false)} />
          <div className="drv-issue-sheet slide-up">
            <div className="drv-ride-sheet__handle" />
            <p style={{padding:'16px 16px 12px',fontWeight:700,fontSize:15}}>
              {lang==='hi'?'समस्या चुनें':lang==='or'?'ସମସ୍ୟା ବାଛନ୍ତୁ':'Select Issue'}
            </p>
            <div className="drv-issue-grid">
              {ISSUES.map((iss,i) => (
                <button key={i} className="drv-issue-btn"
                  onClick={() => {
                    setIssueSheet(false);
                    alert(`Issue reported: ${iss.en}. Control room notified.`);
                  }}>
                  <span className="drv-issue-en">{iss.en}</span>
                  <span className="drv-issue-local">{iss[lang]||iss.en}</span>
                </button>
              ))}
            </div>
            <div style={{padding:'0 16px 24px'}}>
              <button className="btn btn--ghost btn--full" onClick={() => setIssueSheet(false)}>
                {lang==='hi'?'रद्द करें':lang==='or'?'ବାତିଲ':'Cancel'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function SteeringIcon() { return <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/><path d="M12 9V3M9.5 10.5L4.5 7M14.5 10.5l5-3"/></svg>; }
function LockIcon()     { return <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/><circle cx="12" cy="16" r="1.5" fill="currentColor"/></svg>; }
function WarningIcon()  { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>; }
function PhoneIcon()    { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 10.8a19.79 19.79 0 01-3.07-8.67A2 2 0 012 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>; }
function SosIcon()      { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>; }
function QrIcon()       { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>; }
