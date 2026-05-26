/* ── BookRide.jsx — with UPI Intent ── */
import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Header from '../components/Header';
import BottomNav from '../components/BottomNav';
import PlaceSearch from '../components/PlaceSearch';
import { getCurrentPosition, reverseGeocode, watchPosition } from '../services/geocoding';
import { getRoute, calcFare, fmtDist, fmtDuration } from '../services/routing';
import api from '../services/api';
import { connectSocket, getSocket, emitRiderLocation, joinBookingRoom, onBookingUpdate, onDriverLocationUpdate } from '../services/socket';
import { addBooking, getToken, getActiveBooking, setActiveBooking, clearActiveBooking } from '../services/storage';
import './BookRide.css';

// Subtle UI click sound helper
const playPop = () => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(500, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
    g.gain.setValueAtTime(0.1, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.1);
  } catch (e) { /* ignore audio errors */ }
};

// Subtle UI whoosh sound helper for radar search
const playWhoosh = () => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(150, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.2);
    osc.frequency.exponentialRampToValueAtTime(150, ctx.currentTime + 0.5);
    g.gain.setValueAtTime(0, ctx.currentTime);
    g.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 0.1);
    g.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.5);
  } catch (e) { /* ignore audio errors */ }
};

// GenZ Confetti Cannon - Zero dependencies
const triggerConfetti = () => {
  const colors = ['#0D47A1', '#1565C0', '#00A046', '#FFCA28', '#DC2626'];
  const container = document.createElement('div');
  container.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:9999;';
  document.body.appendChild(container);

  for (let i = 0; i < 60; i++) {
    const el = document.createElement('div');
    const color = colors[Math.floor(Math.random() * colors.length)];
    el.style.cssText = `position:absolute;width:10px;height:10px;background:${color};left:50%;bottom:-20px;border-radius:${Math.random() > 0.5 ? '50%' : '2px'};opacity:1;`;
    container.appendChild(el);

    const angle = (Math.random() * 100 - 50) * (Math.PI / 180);
    const velocity = Math.random() * 25 + 15;
    let x = 0, y = 0;
    let vx = Math.sin(angle) * velocity;
    let vy = -Math.cos(angle) * velocity;
    const gravity = 0.7;

    const update = () => {
      vy += gravity;
      vx *= 0.98;
      vy *= 0.98;
      x += vx;
      y += vy;
      el.style.transform = `translate(${x}px, ${y}px) rotate(${x * 4}deg)`;
      
      if (y < window.innerHeight + 100) {
        requestAnimationFrame(update);
      } else {
        el.remove();
      }
    };
    requestAnimationFrame(update);
  }

  setTimeout(() => container.remove(), 4000);
};

// Subtle UI tada sound helper for driver found
const playTada = () => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const now = ctx.currentTime;

    const playNote = (freq, start, duration, volume = 0.1) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, start);
      g.gain.setValueAtTime(0, start);
      g.gain.linearRampToValueAtTime(volume, start + 0.02);
      g.gain.exponentialRampToValueAtTime(0.01, start + duration);
      osc.connect(g);
      g.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + duration);
    };

    playNote(440, now, 0.12, 0.08);       // Note 1: A4 (low)
    playNote(659.25, now + 0.12, 0.6, 0.1); // Note 2: E5 (high, triumphant)

    // Vibration pattern: [Note 1 pulse, Gap, Note 2 pulse]
    window.navigator?.vibrate?.([40, 80, 150]);

    // Visual celebration
    triggerConfetti();
  } catch (e) { /* ignore audio errors */ }
};

const TYPES = [
  { id: 'auto', label: 'Auto Rickshaw', cap: 'Up to 3 passengers', eta: '3–6 min', emoji: '🛺' },
  { id: 'cab',  label: 'Cab',           cap: 'Up to 4 passengers', eta: '5–8 min', emoji: '🚕' },
];

const TIMEOUT_SECONDS = 60;

export default function BookRide() {
  const navigate = useNavigate();
  const [sp] = useSearchParams();

  const [type,          setType]          = useState(sp.get('type') || 'auto');
  const [pickup,        setPickup]        = useState('');
  const [pickupCoords,  setPickupCoords]  = useState(null);
  const [dropoff,       setDropoff]       = useState('');
  const [dropoffCoords, setDropoffCoords] = useState(null);
  const [route,         setRoute]         = useState(null);
  const [fare,          setFare]          = useState(null);
  const [routeLoading,  setRouteLoading]  = useState(false);
  const [payment,       setPayment]       = useState('Cash');
  const [booking,       setBooking]       = useState(null);
  const [bookingId,     setBookingId]     = useState(null);
  const [driver,        setDriver]        = useState(null);
  const [otp,           setOtp]           = useState(null);
  const [driverLocation, setDriverLocation] = useState(null);
  const [socketDebug, setSocketDebug] = useState([]);
  const [countdown,     setCountdown]     = useState(TIMEOUT_SECONDS);
  const [payLoading,    setPayLoading]    = useState(false);
  const [rideStatus,    setRideStatus]    = useState(null);
  const [showQr,       setShowQr]       = useState(false);
  const [isBoarded,    setIsBoarded]    = useState(false);

  const driverIdRef            = useRef(null);
  const driverLocationRef      = useRef(null);
  const riderLocationWatchRef  = useRef(null);
  const roomUnsubRef           = useRef(null);
  const pollRef                = useRef(null);
  const timeoutRef             = useRef(null);
  const countdownRef           = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const pos = await getCurrentPosition();
        setPickupCoords(pos);
        setPickup(await reverseGeocode(pos.lat, pos.lng));
      } catch { setPickup('Current Location'); }
    })();
  }, []);

  // ── Restore active booking on mount ─────────────────────────
  useEffect(() => {
    const syncActiveBooking = async () => {
      try {
        const result = await api.getActiveBooking(getToken());
        const b = result?.booking;
        if (!b) {
          if (bookingId) handleBookingTermination(null); 
          return;
        }

        // Calculate remaining countdown time based on creation date
        const createdAt = new Date(b.createdAt).getTime();
        const elapsed = Math.floor((Date.now() - createdAt) / 1000);
        const remaining = Math.max(0, TIMEOUT_SECONDS - elapsed);
        setCountdown(remaining);

        // Atomic update of state
        setBookingId(b._id || b.id);
        setBooking(b.status === 'searching' ? 'searching' : 'found');
        setRideStatus(b.status);
        if (b.startOTP) setOtp(b.startOTP);
        if (b.driverId) {
          const d = {
            driverId: b.driverId._id,
            name: b.driverId.name,
            phone: b.driverId.phone,
            vehicleNumber: b.driverId.vehicleNumber,
            rating: b.driverId.rating,
            eta: b.eta || '3–5 min'
          };
          setDriver(d);
          driverIdRef.current = d.driverId;
        }
      } catch {}
    };
    syncActiveBooking();
  }, []);

  const updateActiveStatus = (status) => {
    const current = getActiveBooking();
    setRideStatus(status);
    if (current) setActiveBooking({ ...current, status });
  };

  const handleBookingTermination = (finalStatus) => {
    if (roomUnsubRef.current) {
      roomUnsubRef.current();
      roomUnsubRef.current = null;
    }
    stopPolling();
    clearActiveBooking();
    setBooking(finalStatus);
    setRideStatus(null);
    setIsBoarded(false);
    setBookingId(null);
    setDriver(null);
    setDriverLocation(null);
    setRoute(null);
    setFare(null);
  };

  // Main Socket & State Lifecycle Effect
  useEffect(() => {
    if (!bookingId) return;

    const socket = connectSocket();

    // 1. Rider Location Sharing
    if (riderLocationWatchRef.current) riderLocationWatchRef.current();
    riderLocationWatchRef.current = watchPosition(pos => {
      emitRiderLocation({ 
        bookingId, lat: pos.lat, lng: pos.lng, 
        bearing: pos.bearing, speed: pos.speed 
      });
    });

    // 2. Attach Driver Location Listener
    const unsubLocation = onDriverLocationUpdate((data) => {
      if (driverIdRef.current && String(driverIdRef.current) === String(data.driverId)) {
        setDriverLocation({ lat: data.lat, lng: data.lng, bearing: data.bearing, speed: data.speed });
      }
    });

    // 3. Attach Main Booking Handler
    const unsubUpdate = onBookingUpdate(bookingId, (data) => {
      setSocketDebug(d => [...d.slice(-9), { t: Date.now(), e: `booking_event:${data.action}`, d: data }]);

      // ✅ STRICT SYNC: Only transition to 'found' if the action is a fresh 'accept' 
      // or a 'sync' that contains a valid, currently assigned driver.
      if ((data.action === 'accept' && data.driver?.name) || (data.action === 'sync' && data.driver?.driverId)) {
        playTada();
        setDriver(data.driver);
        driverIdRef.current = data.driver.driverId;
        if (data.otp) setOtp(data.otp);
        if (data.location || data.driver.location) setDriverLocation(data.location || data.driver.location);
        
        setBooking('found');
        setRideStatus('accepted');
        stopPolling();
      } else if (data.action === 'started') {
        if (data.driver) {
          setDriver(data.driver);
          driverIdRef.current = data.driver.driverId;
        }
        setBooking('found');
        updateActiveStatus('started');
      } else if (data.action === 'completed') {
        handleBookingTermination('completed');
      } else if (data.action === 'cancelled') {
        handleBookingTermination('cancelled');
      } else if (data.action === 'driver_offline') {
        handleBookingTermination('driver_offline');
      } else if (data.action === 'driver_arrived') {
        setSocketDebug(prev => [...prev, { t: Date.now(), e: 'info', d: 'Driver has arrived!' }]);
      } else if (data.action === 'health_alert') {
        setSocketDebug(prev => [...prev, { t: Date.now(), e: 'health_check', d: data.message }]);
      }
    });

    const roomUnsub = joinBookingRoom(String(bookingId), getToken());

    // 4. Searching Timeout Logic
    let countdownInt = null;
    if (booking === 'searching') {
      countdownInt = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(countdownInt);
            handleBookingTermination('timeout');
            api.cancelBooking(bookingId, getToken()).catch(() => {});
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    // Polished Polling Fallback
    startPolling(bookingId);

    roomUnsubRef.current = () => {
      unsubUpdate();
      unsubLocation();
      roomUnsub();
      if (countdownInt) clearInterval(countdownInt);
      if (riderLocationWatchRef.current) {
        riderLocationWatchRef.current();
        riderLocationWatchRef.current = null;
      }
    };

    return () => {
      if (roomUnsubRef.current) {
        roomUnsubRef.current();
        roomUnsubRef.current = null;
      }
      stopPolling();
    };
  }, [bookingId, booking]);

  // ✅ UBER-STYLE POLLING: self-heal if socket events are missed
  // This is a fallback for when socket events are missed or the app is restored.
  const startPolling = (id) => {
    stopPolling();
    pollRef.current = setInterval(async () => {
      const res = await api.getActiveBooking(getToken());
      if (res?.booking?.status === 'accepted' || res?.booking?.status === 'started') {
        const b = res.booking;
        setDriver({
          driverId: b.driverId._id,
          name: b.driverId.name,
          phone: b.driverId.phone,
          vehicleNumber: b.driverId.vehicleNumber,
          rating: b.driverId.rating,
          eta: b.eta || '3-5 min'
        });
        driverIdRef.current = b.driverId._id;
        if (b.startOTP) setOtp(b.startOTP);
        setBooking('found');
        setRideStatus(b.status);
        stopPolling(); // logic restored, stop polling
      }
    }, 5000);
  };

  const stopPolling = () => { if(pollRef.current) clearInterval(pollRef.current); };

  useEffect(() => {
    if (!pickupCoords || !dropoffCoords) { setRoute(null); setFare(null); return; }
    (async () => {
      setRouteLoading(true);
      try {
        const [f, r] = await Promise.all([
          api.getFareEstimate(pickupCoords, dropoffCoords, type).catch(() => null),
          getRoute(pickupCoords, dropoffCoords),
        ]);
        setRoute(r);
        if (f) {
          setFare({ min: f.min, max: f.max, amount: f.min, display: `₹${f.min}–₹${f.max}` });
        } else if (r) {
          const calc = calcFare(r.distanceKm, type);
          setFare({ ...calc, amount: calc.min || calc.amount || 50 });
        }
      } catch {
        const r = await getRoute(pickupCoords, dropoffCoords).catch(() => null);
        if (r) {
          const calc = calcFare(r.distanceKm, type);
          setRoute(r);
          setFare({ ...calc, amount: calc.min || calc.amount || 50 });
        }
      } finally { setRouteLoading(false); }
    })();
  }, [pickupCoords, dropoffCoords, type]);

  // ── Create booking + start driver search ─────────────────────
  const startBooking = async () => {
    playWhoosh();
    setBooking('searching');
    setCountdown(TIMEOUT_SECONDS);
    const fareAmount = fare?.amount || 50;
    const bk = {
      type, pickup, pickupCoords, dropoff, dropoffCoords,
      fare:        fare?.display || `₹${fareAmount}`,
      fareAmount,  payment,
      distance:    route?.distanceKm ? `${route.distanceKm} km` : '--',
      duration:    route?.durationMin ? `${route.durationMin} min` : '--',
      paid: payment === 'Online', // UPI Intent logic
    };
    try {
      const { booking: b } = await api.createBooking(bk, getToken());
      if (!b?.id) throw new Error('No booking ID returned');
      addBooking(b);
      setBookingId(b.id);
      if (b.otp) setOtp(b.otp);
      setRideStatus(b.status);
      setActiveBooking({
        id: b.id,
        status: b.status,
        type, pickup, pickupCoords, dropoff, dropoffCoords,
        payment, fareAmount, fare: bk.fare, 
        otp: b.otp,
      });
    } catch (err) {
      setBooking(null);
      setPayLoading(false);
      alert(err.message || 'Unable to connect. Check your connection.');
    }
  };

  const handleBook = async () => {
    if (!pickup || !dropoff) { alert('Please enter pickup and drop location'); return; }
    const isValidCoord = (c) =>
      c && typeof c.lat === 'number' && typeof c.lng === 'number' &&
      !isNaN(c.lat) && !isNaN(c.lng);
    if (!isValidCoord(pickupCoords))  { alert('Could not get pickup coordinates. Try searching the location again.'); return; }
    if (!isValidCoord(dropoffCoords)) { alert('Could not get drop-off coordinates. Try searching the location again.'); return; }
    
    if (payment === 'Online') {
      // FREE ALTERNATIVE: UPI Intent (Deep Link)
      // pa: your VPA/UPI ID, pn: Merchant Name
      const upiUrl = `upi://pay?pa=YOUR_UPI_ID@bank&pn=MoveOnGo&am=${fare?.amount || 50}&cu=INR`;
      window.location.href = upiUrl;
      // Delay search slightly to allow the user to switch apps
      setTimeout(() => startBooking(), 3000);
    } else {
      await startBooking();
    }
  };

  const handleShareLocation = async () => {
    if (!driver) return;
    const text = `✨ On my way with MoveOn Go! ✨\nDriver: ${driver.name} (${driver.vehicleNumber})\nTrack me live here:`;
    const url = `${window.location.origin}/track/${bookingId}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'MoveOn Go - Ride Tracking',
          text: text,
          url: url,
        });
      } catch (err) { /* User cancelled share */ }
    } else {
      try {
        await navigator.clipboard.writeText(`${text} ${url}`);
        alert('Trip details copied to clipboard!');
      } catch (err) {
        alert('Could not share trip details.');
      }
    }
  };

  const handleCancel = async () => {
    // CRITICAL ORDER: Call the API FIRST, THEN clean up local state and listeners.
    if (bookingId) {
      try { await api.cancelBooking(bookingId, getToken()); } catch {}
    }
    handleBookingTermination('cancelled'); // Use the consolidated termination handler
    setPayLoading(false); // Ensure payment loading is reset
    setRideStatus(null);
    setIsBoarded(false);
  };

  // Function to manually re-fetch the OTP/Booking if "lost"
  const refreshBooking = async () => {
    try {
      const result = await api.getActiveBooking(getToken());
      if (result?.booking) {
        setOtp(result.booking.startOTP);
        const current = getActiveBooking();
        setActiveBooking({ ...current, otp: result.booking.startOTP });
      }
    } catch (err) {
      console.error('Failed to refresh booking:', err);
    }
  };

  // ── Searching ────────────────────────────────────────────────
  if (booking === 'searching') return (
    <div className="app">
      <Header title="Searching..." showBack onBack={handleCancel}/>
      <div className="page br-waiting">
        <div className="br-pulse-wrap">
          <div className="br-pulse-ring"/>
          <div className="br-pulse-ring br-pulse-ring--2"/>
          <div className="br-pulse-glow"/>
          <span style={{fontSize:40}}>{TYPES.find(t=>t.id===type)?.emoji||'🚗'}</span>
        </div>
        <p className="br-waiting-title">Matching you with the best {type}...</p>
        <p className="br-waiting-sub">Hang tight, we're almost there! ⚡</p>
        
        <div className="br-countdown-pill" style={{ color: countdown < 10 ? '#ff4d4d' : 'inherit' }}>
           Searching for {countdown}s
        </div>
        <button className="btn btn--secondary btn--lg" style={{marginTop:32, borderRadius:'30px', padding:'12px 40px'}} onClick={handleCancel}>Cancel Request</button>
      </div>
    </div>
  );

  // Debug panel
  const DebugPanel = () => import.meta.env.DEV && (
    <div style={{ position: 'fixed', right: 8, bottom: 8, zIndex: 1000, background: 'rgba(0,0,0,0.6)', color: '#fff', padding: 8, borderRadius: 6, fontSize: 12, maxWidth: 360 }}>
      <div style={{ fontWeight: 'bold', marginBottom: 6 }}>Socket Debug</div>
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

  // ── Timeout ──────────────────────────────────────────────────
  if (booking === 'timeout') return (
    <div className="app">
      <Header title="No Driver Found" showBack onBack={() => setBooking(null)}/>
      <div className="page" style={{padding:'40px 24px',textAlign:'center'}}>
        <div style={{fontSize:56,marginBottom:16}}>😔</div>
        <h2 style={{fontSize:18,fontWeight:700,marginBottom:8}}>No drivers available</h2>
        <p style={{color:'var(--gray-500)',fontSize:14,marginBottom:32}}>
          No {type} drivers available near you right now. Please try again in a few minutes.
        </p>
        <button className="btn btn--primary btn--full btn--lg" onClick={() => setBooking(null)}>Try Again</button>
      </div>
      <BottomNav/>
    </div>
  );

  // ── Driver went offline mid-ride ────────────────────────────
  if (booking === 'driver_offline') return (
    <div className="app">
      <Header title="Driver Unavailable" showBack onBack={() => setBooking(null)}/>
      <div className="page" style={{padding:'40px 24px',textAlign:'center'}}>
        <div style={{fontSize:56,marginBottom:16}}>📵</div>
        <h2 style={{fontSize:18,fontWeight:700,marginBottom:8}}>Driver went offline</h2>
        <p style={{color:'var(--gray-500)',fontSize:14,marginBottom:32}}>
          Your driver lost connection. Please book again — we're sorry for the inconvenience.
        </p>
        <button className="btn btn--primary btn--full btn--lg" onClick={() => setBooking(null)}>Book Again</button>
      </div>
      <BottomNav/>
    </div>
  );

  if (booking === 'cancelled') return (
    <div className="app">
      <Header title="Ride Cancelled" showBack onBack={() => setBooking(null)}/>
      <div className="page" style={{padding:'40px 24px',textAlign:'center'}}>
        <div style={{fontSize:56,marginBottom:16}}>🚫</div>
        <h2 style={{fontSize:18,fontWeight:700,marginBottom:8}}>Your ride was cancelled</h2>
        <p style={{color:'var(--gray-500)',fontSize:14,marginBottom:32}}>
          The driver cancelled the ride. You can search again or choose another vehicle.
        </p>
        <button className="btn btn--primary btn--full btn--lg" onClick={() => setBooking(null)}>Book again</button>
      </div>
      <BottomNav/>
    </div>
  );

  if (booking === 'completed') return (
    <div className="app">
      <Header title="Trip Completed" showBack onBack={() => setBooking(null)}/>
      <div className="page" style={{padding:'40px 24px',textAlign:'center'}}>
        <div style={{fontSize:56,marginBottom:16}}>✅</div>
        <h2 style={{fontSize:18,fontWeight:700,marginBottom:8}}>Your trip is complete</h2>
        <p style={{color:'var(--gray-500)',fontSize:14,marginBottom:32}}>
          Thank you for riding with us. Please rate the trip or book another ride.
        </p>
        <button className="btn btn--primary btn--full btn--lg" onClick={() => setBooking(null)}>Book again</button>
      </div>
      <BottomNav/>
    </div>
  );

  // ── Driver found ─────────────────────────────────────────────
  if (booking === 'found' && driver) return (
    <div className="app">
      <Header title="Ride Secured! ✅"/>
      <div className="page" style={{padding:'20px 16px'}}>
        <div className="card br-driver-card slide-up">
          <div className="br-ride-live-tag">
             <span className="live-dot" /> LIVE TRACKING
          </div>

          <div className="br-driver-top">
            <div className="br-driver-avatar">{driver.name?.[0]||'D'}</div>
            <div style={{flex:1}}>
              <div className="br-driver-name">{driver.name}</div>
              <div className="br-driver-rating">⭐ {driver.rating||'4.8'} • {driver.vehicleNumber}</div>
            </div>
            <a href={`tel:${driver.phone}`} className="br-call-btn">
               <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 10.8a19.79 19.79 0 01-3.07-8.67A2 2 0 012 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>
            </a>
          </div>
          
          <div className="br-driver-eta">Arriving in <span className="highlight">{driver.eta||'4 mins'}</span></div>
          
          <div className="br-driver-details">
            <div className="br-det-item">📏 {route?.distanceKm || '--'} km</div>
            <div className="br-det-item">⏱ {route?.durationMin || '--'} min</div>
            <div className="br-det-item">💰 {fare?.display || '₹--'}</div>
            <div className="br-det-item">💳 {payment}</div>
          </div>

          {payment !== 'Cash' && (
            <div className="br-paid-badge">✅ Payment Confirmed via UPI</div>
          )}

          <div className="br-otp-card">
            <div className="br-otp-info">
              <span className="br-otp-label">TRIP CODE (For Reference)</span>
              <span className="br-otp-val">{otp || '----'}</span>
            </div>
          </div>

          {payment === 'Cash' && rideStatus === 'started' && (
            <button 
              className="btn btn--success btn--full" 
              style={{marginTop: 16, height: 48, fontWeight: 700, fontSize: 14}}
              onClick={(e) => { e.target.disabled = true; e.target.innerText = '✅ Payment Confirmed'; alert('Cash payment acknowledged. Thank you for riding with MoveOn Go!'); }}
            >
              💵 I have paid Cash
            </button>
          )}
        </div>

        {showQr && (
          <>
            <div className="overlay" onClick={() => setShowQr(false)} style={{zIndex: 2000, background: 'rgba(0,0,0,0.7)'}} />
            <div className="card slide-up" style={{
              position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
              zIndex: 2001, padding: 24, textAlign: 'center', width: '85%', maxWidth: 320,
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
            }}>
              <h3 style={{marginBottom: 16, fontSize: 18, fontWeight: 700}}>Scan to Track</h3>
              <div style={{ background: 'white', padding: 12, borderRadius: 12, display: 'inline-block', border: '1px solid var(--gray-200)' }}>
                <img 
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(`${window.location.origin}/track/${bookingId}`)}`} 
                  alt="QR Code" 
                  style={{display: 'block', width: 200, height: 200}}
                />
              </div>
              <p style={{fontSize: 13, color: 'var(--gray-500)', marginTop: 16, lineHeight: 1.5}}>
                Ask the driver to scan this code to track the live trip on their device.
              </p>
              <button className="btn btn--primary btn--full btn--lg" style={{marginTop: 20}} onClick={() => setShowQr(false)}>Close</button>
            </div>
          </>
        )}

        <div style={{display:'flex',gap:12,marginTop:16,flexWrap:'wrap'}}>
          <button className="btn btn--secondary btn--lg" style={{flex:1,minWidth:'140px'}} onClick={() => navigate('/map')}>Track on Map</button>
          <button className="btn btn--secondary btn--lg" style={{flex:1,minWidth:'140px',display:'flex',alignItems:'center',justifyContent:'center',gap:8}} onClick={handleShareLocation}>
            <ShareIcon /> Share Trip
          </button>
          <button className="btn btn--secondary btn--lg" style={{flex:1,minWidth:'140px',display:'flex',alignItems:'center',justifyContent:'center',gap:8}} onClick={() => setShowQr(true)}>
            <QrIcon /> Show QR
          </button>
          {/* FIX: Disable cancellation if trip has already started */}
          {getActiveBooking()?.status !== 'started' && (
            <button className="btn btn--danger btn--lg" style={{flex:1,minWidth:'140px'}} onClick={handleCancel}>Cancel Ride</button>
          )}
        </div>
      </div>
      <BottomNav/>

      {/* ✅ Floating Boarded Toggle: Allows users to manually signal boarding */}
      {rideStatus === 'started' && (
        <button 
          className={`br-boarded-btn ${isBoarded ? 'toggled' : ''}`} 
          disabled={isBoarded}
          onClick={async () => { 
            if (isBoarded) return;
            const nextState = !isBoarded;
            setIsBoarded(nextState); 
            playPop(); 
            window.navigator?.vibrate?.(20); 
            
            if (nextState && bookingId) {
              try {
                await api.riderBoarded(bookingId, getToken());
              } catch (err) {
                console.error("Failed to notify boarding:", err);
              }
            }
          }}
        >
          <span>{isBoarded ? '✅' : '🚌'}</span>
          {isBoarded ? 'BOARDED' : 'BOARDED?'}
        </button>
      )}
    </div>
  );

  // ── Main screen ──────────────────────────────────────────────
  return (
    <div className="app">
      <Header title="Book a Ride" showBack onBack={() => navigate(-1)}/>
      <div className="page" style={{padding:'16px'}}>

        <p className="section-label slide-up" style={{padding:'0 0 8px', animationDelay: '0.05s'}}>Select Vehicle</p>
        <div style={{display:'flex',flexDirection:'column',gap:8,marginBottom:20}}>
          {TYPES.map(v => (
            <button key={v.id}
              className={`br-type-card card ${type===v.id?'br-type-card--selected':''}`} style={{borderRadius:'20px'}}
              onClick={() => {
                playPop();
                window.navigator?.vibrate?.(10);
                setType(v.id);
              }}>
              <span style={{fontSize:22,marginRight:8}}>{v.emoji}</span>
              <div style={{flex:1}}>
                <div className="br-type-label">{v.label}</div>
                <div className="br-type-sub">{v.cap} · {v.eta}</div>
              </div>
              <div className={`br-radio ${type===v.id?'checked':''}`} />
            </button>
          ))}
        </div>

        <p className="section-label" style={{padding:'0 0 8px'}}>Route Details</p>
        <div className="card" style={{padding:14,marginBottom:14,overflow:'visible', borderRadius:'24px', border:'1px solid rgba(0,0,0,0.05)'}}>
          <PlaceSearch placeholder="Pickup location" value={pickup}
            onSelect={p => { if(p){setPickupCoords(p);setPickup(p.name);}else setPickupCoords(null); }}
            dotColor="var(--green-600)"/>
          <div style={{height:1,background:'var(--gray-200)',margin:'10px 0 10px 20px'}}/>
          <PlaceSearch placeholder="Drop location" value={dropoff}
            onSelect={p => { if(p){setDropoffCoords(p);setDropoff(p.name);}else setDropoffCoords(null); }}
            dotColor="var(--danger)"/>
        </div>

        {routeLoading && (
          <div style={{display:'flex',alignItems:'center',gap:10,padding:'8px 0',color:'var(--gray-400)',fontSize:13}}>
            <span className="spinner" style={{width:14,height:14,borderWidth:1.5}}/> Calculating route...
          </div>
        )}

        {route && fare && !routeLoading && (
          <div className="card" style={{padding:14,marginBottom:14}}>
            {[[fmtDist(route.distance),'Distance'],[fmtDuration(route.duration),'Duration'],[fare.display,'Fare Estimate']].map(([v,l],i,a) => (
              <div key={i}>
                <div style={{display:'flex',justifyContent:'space-between',padding:'6px 0',fontSize:13}}>
                  <span style={{color:'var(--gray-500)'}}>{l}</span>
                  <strong style={{color:i===2?'var(--green-600)':'var(--gray-900)'}}>{v}</strong>
                </div>
                {i<a.length-1 && <div className="divider"/>}
              </div>
            ))}
          </div>
        )}

        <p className="section-label" style={{padding:'0 0 8px'}}>Payment Method</p>
        <div style={{display:'flex',gap:8,marginBottom:8}}>
          {/* FIX #3: UPI and Card were shown as separate options but both
              routed through Razorpay — which was never wired up, causing a
              crash ("api.createPaymentOrder is not a function"). Now: Cash
              for offline payment, Online for Razorpay (supports UPI + Cards
              + Net Banking all in one checkout flow). */}
          {[{id:'Cash',icon:'💵'},{id:'Online',icon:'📱'}].map(m => (
            <button key={m.id}
              className={`chip ${payment===m.id?'active':''}`}
              style={{flex:1,justifyContent:'center',padding:'10px',flexDirection:'column',height:52,gap:2}}
              onClick={() => setPayment(m.id)}>
              <span style={{fontSize:16}}>{m.icon}</span>
              <span style={{fontSize:11}}>{m.id}</span>
            </button>
          ))}
        </div>

        {payment !== 'Cash' && (
          <div className="br-payment-note">
            🔒 Secure payment via UPI · Intent based deep-linking
          </div>
        )}

        <div style={{marginTop:16}}>
          <button className="btn btn--primary btn--full btn--lg"
            onClick={handleBook}
            disabled={!pickup||!dropoff||routeLoading||payLoading}>
            {payLoading
              ? <><span className="spinner" style={{width:16,height:16,borderWidth:2}}/> Opening Payment…</>
              : !dropoff          ? 'Enter Drop Location'
              : routeLoading      ? 'Calculating...'
              : payment === 'Cash'? `Book ${TYPES.find(v=>v.id===type)?.label} · ${fare?.display||'Get Fare'}`
              :                     `Pay Online · ${fare?.display||'Get Fare'}`
            }
          </button>
        </div>

      </div>
      <BottomNav/>
    </div>
  );
}

function ShareIcon() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13"/></svg>; }
function QrIcon() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>; }