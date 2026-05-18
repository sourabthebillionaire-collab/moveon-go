import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import api from '../services/api';
import { emitLocation, onRideRequest, connectSocket, disconnectSocket, getSocket } from '../services/socket';
import { setDriverSession, getDriver, getDriverToken, clearDriverSession } from '../services/storage';
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
  const unwatchRef   = useRef(null);
  const pingRef      = useRef(null);
  const gpsPosRef    = useRef(null); // keep GPS pos accessible in interval closure

  const t = T[lang];

  // ── Restore session on mount ────────────────────────────────
  useEffect(() => {
    const token = getDriverToken();
    const saved = getDriver();
    if (!token || !saved) return;

    (async () => {
      try {
        const socket = connectSocket();
        socket.emit('driver:register', { driverId: saved.id || saved._id });

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

        await api.getDriverProfile(token);
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
    };
  }, []);

  // ── Auth: Step 1 — validate Vehicle ID ─────────────────────
  const handleValidateId = async () => {
    if (!vehicleId.trim()) return;
    setBusy(true); setError('');
    try {
      await api.validateVehicleId(vehicleId.trim().toUpperCase());
      setStep('pin');
      setTimeout(() => pinInputRef.current?.focus(), 200);
    } catch (err) {
      setError(err.status === 404 ? t.errInvalidId : t.errServer);
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
      socket.emit('driver:register', { driverId: d.id || d._id });

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

  // ── Panel: start duty ───────────────────────────────────────
  const startDuty = async () => {
    setOnDuty(true);
    speak(t.gpsActive, lang);
    try { await api.setDriverDuty(true, getDriverToken()); } catch {}

    const basePayload = {
      driverId:      driver?.id || driver?._id,
      vehicleId:     driver?.vehicleId,
      type:          driver?.vehicleType,
      vehicleNumber: driver?.vehicleNumber,
      busName:       driver?.busName     || '',
      routeFrom:     driver?.routeFrom   || '',
      routeTo:       driver?.routeTo     || '',
      routeNumber:   driver?.routeNumber || '',
    };

    unwatchRef.current = watchPosition(pos => {
      setGpsPos(pos);
      gpsPosRef.current = pos;
      setSpeed(Math.round((pos.speed || 0) * 3.6));
      emitLocation({
        ...basePayload,
        lat: pos.lat, lng: pos.lng,
        bearing: pos.bearing || 0,
        speed: Math.round((pos.speed || 0) * 3.6),
        status: 'active',
      });
    });

    pingRef.current = setInterval(() => {
      const pos = gpsPosRef.current;
      if (pos) emitLocation({
        ...basePayload,
        lat: pos.lat, lng: pos.lng,
        status: 'active',
      });
    }, 10000);
  };

  // ── Panel: end duty ─────────────────────────────────────────
  const endDuty = async () => {
    if (!window.confirm(t.confirmEnd)) return;
    unwatchRef.current?.(); unwatchRef.current = null;
    clearInterval(pingRef.current); pingRef.current = null;
    gpsPosRef.current = null;
    setOnDuty(false); setGpsPos(null); setSpeed(0);
    setTripActive(false); setRideReq(null); setActiveRide(null); setUserLocation(null);
    try { await api.setDriverDuty(false, getDriverToken()); } catch {}
    disconnectSocket();
  };

  // ── Listen for ride requests ────────────────────────────────
  useEffect(() => {
    if (!onDuty) return;
    const unsub = onRideRequest(req => {
      setRideReq(req);
      speak(
        lang === 'hi' ? 'नई बुकिंग आई है।' :
        lang === 'or' ? 'ନୂଆ ବୁକିଂ ଆସିଛି।' :
        'New ride request.',
        lang,
      );
    });
    return unsub;
  }, [onDuty, lang]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleRiderLocation = ({ bookingId, lat, lng, bearing, speed }) => {
      if (!activeRide || String(bookingId) !== String(activeRide.id)) return;
      setUserLocation({ lat, lng, bearing, speed });
    };

    socket.on('rider:locationUpdate', handleRiderLocation);
    return () => socket.off('rider:locationUpdate', handleRiderLocation);
  }, [activeRide]);

  // ── Accept ride ─────────────────────────────────────────────
  // ✅ FIXED: Only the HTTP call is made here.
  // The backend route handles emitting the socket event WITH full driver
  // details to the booking room. The old emitRideResponse() socket call
  // was firing simultaneously and overwriting the driver info with { action }
  // only — that was the race condition causing the 60s wait on the rider side.
  const acceptRide = async () => {
    if (!rideReq) return;
    try {
      await api.respondToRide(rideReq.id, 'accept', getDriverToken());
      // ✅ DO NOT call emitRideResponse here — backend handles socket emit
      setActiveRide({ ...rideReq, id: rideReq.id });
      setUserLocation(null);
      setTripActive(true);
      setPassengers(p => p + 1);
      setRideReq(null);
      speak(
        lang === 'hi' ? 'बुकिंग स्वीकार।' :
        lang === 'or' ? 'ବୁକିଂ ଗ୍ରହଣ।' :
        'Ride accepted.',
        lang,
      );
    } catch (err) {
      console.error('[Driver] Failed to accept ride:', err);
      // Show error to driver so they know the accept didn't go through
      alert('Failed to accept ride. Please try again.');
    }
  };

  // ── Decline ride ────────────────────────────────────────────
  // ✅ FIXED: Same fix — HTTP only, no redundant socket emit
  const declineRide = async () => {
    if (!rideReq) return;
    try {
      await api.respondToRide(rideReq.id, 'decline', getDriverToken());
      // ✅ DO NOT call emitRideResponse here — backend handles socket emit
      setRideReq(null);
    } catch (err) {
      console.error('[Driver] Failed to decline ride:', err);
      setRideReq(null); // dismiss UI even on error
    }
  };

  // ── End trip ────────────────────────────────────────────────
  const endTrip = () => {
    setTripActive(false);
    setTripCount(c => c + 1);
    setEarnings(e => e + (activeRide?.fareAmount || 120));
    setActiveRide(null);
    setUserLocation(null);
    speak(
      lang === 'hi' ? 'यात्रा खत्म।' :
      lang === 'or' ? 'ଯାତ୍ରା ଶେଷ।' :
      'Trip ended.',
      lang,
    );
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
  const signOut = () => {
    endDuty().catch(() => {});
    clearDriverSession();
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
          <div className="drv-gps-bar">
            <span className="live-dot" style={{width:7,height:7}}/>
            <span>{t.gpsActive}</span>
            {gpsPos && <span className="drv-gps-coords">{gpsPos.lat.toFixed(4)}, {gpsPos.lng.toFixed(4)}</span>}
          </div>
        )}

        {activeRide && (
          <div className="drv-user-location-card card" style={{margin:'12px 16px',padding:'12px 14px'}}>
            <div style={{fontSize:12,color:'var(--gray-500)',marginBottom:4}}>Passenger location</div>
            {userLocation ? (
              <div style={{fontSize:14,fontWeight:700}}>{userLocation.lat.toFixed(4)}, {userLocation.lng.toFixed(4)}</div>
            ) : (
              <div style={{fontSize:14,color:'var(--gray-500)'}}>Waiting for passenger location…</div>
            )}
          </div>
        )}

        <div className="drv-main-action">
          {!onDuty ? (
            <button className="drv-duty-btn start" onClick={startDuty}>{t.startDuty}</button>
          ) : tripActive ? (
            <button className="drv-duty-btn end-trip" onClick={endTrip}>{t.endTrip}</button>
          ) : (
            <button className="drv-duty-btn end-duty" onClick={endDuty}>{t.endDuty}</button>
          )}
        </div>

        {onDuty && (
          <div className="drv-actions">
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
