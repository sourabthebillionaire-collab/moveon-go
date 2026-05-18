/* ── BookRide.jsx — with Razorpay ── */
import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Header from '../components/Header';
import BottomNav from '../components/BottomNav';
import PlaceSearch from '../components/PlaceSearch';
import { getCurrentPosition, reverseGeocode, watchPosition } from '../services/geocoding';
import { getRoute, calcFare, fmtDist, fmtDuration } from '../services/routing';
import api from '../services/api';
import { connectSocket, getSocket, emitRiderLocation } from '../services/socket';
import { addBooking, getToken } from '../services/storage';
import './BookRide.css';

const RAZORPAY_KEY_ID = import.meta.env.VITE_RAZORPAY_KEY_ID || 'rzp_test_SqiUHd7YtEIDor';

const TYPES = [
  { id: 'auto', label: 'Auto Rickshaw', cap: 'Up to 3 passengers', eta: '3–6 min', emoji: '🛺' },
  { id: 'cab',  label: 'Cab',           cap: 'Up to 4 passengers', eta: '5–8 min', emoji: '🚕' },
  { id: 'bike', label: 'Bike',          cap: '1 passenger',        eta: '2–4 min', emoji: '🏍️' },
];

const TIMEOUT_SECONDS = 60;

function loadRazorpay() {
  return new Promise(resolve => {
    if (window.Razorpay) { resolve(true); return; }
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload  = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

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
  const [driverLocation, setDriverLocation] = useState(null);
  const [countdown,     setCountdown]     = useState(TIMEOUT_SECONDS);
  const [payLoading,    setPayLoading]    = useState(false);

  const driverIdRef            = useRef(null);
  const driverLocationRef      = useRef(null);
  const riderLocationWatchRef  = useRef(null);
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
    loadRazorpay(); // preload
  }, []);

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

  useEffect(() => {
    return () => {
      clearTimeout(timeoutRef.current);
      clearInterval(countdownRef.current);
      if (riderLocationWatchRef.current) {
        riderLocationWatchRef.current();
        riderLocationWatchRef.current = null;
      }
      const socket = getSocket();
      if (socket && bookingId) {
        socket.off(`booking:${bookingId}`);
        if (driverLocationRef.current) {
          socket.off('driver:locationUpdate', driverLocationRef.current);
          driverLocationRef.current = null;
        }
      }
    };
  }, [bookingId]);

  // ── Create booking + start driver search ─────────────────────
  const startBooking = async (paymentInfo = {}) => {
    setBooking('searching');
    setCountdown(TIMEOUT_SECONDS);
    const fareAmount = fare?.amount || 50;
    const bk = {
      type, pickup, pickupCoords, dropoff, dropoffCoords,
      fare:        fare?.display || `₹${fareAmount}`,
      fareAmount,  payment,
      distance:    route?.distanceKm ? `${route.distanceKm} km` : '--',
      duration:    route?.durationMin ? `${route.durationMin} min` : '--',
      razorpayOrderId:   paymentInfo.razorpay_order_id   || null,
      razorpayPaymentId: paymentInfo.razorpay_payment_id || null,
      razorpaySignature: paymentInfo.razorpay_signature  || null,
      paid: !!paymentInfo.razorpay_payment_id,
    };
    try {
      const { booking: b } = await api.createBooking(bk, getToken());
      if (!b?.id) throw new Error('No booking ID returned');
      addBooking(b);
      setBookingId(b.id);
      const socket = connectSocket();

      // ✅ JOIN the booking room so backend can target this socket.
      // If the socket is not yet connected, wait until it is.
      if (socket.connected) {
        socket.emit('rider:joinBooking', { bookingId: b.id });
      } else {
        socket.once('connect', () => socket.emit('rider:joinBooking', { bookingId: b.id }));
      }

      if (riderLocationWatchRef.current) {
        riderLocationWatchRef.current();
      }
      riderLocationWatchRef.current = watchPosition(pos => {
        emitRiderLocation({ bookingId: b.id, lat: pos.lat, lng: pos.lng, bearing: pos.bearing, speed: pos.speed });
      });

      const bookingEvent = `booking:${b.id}`;
      const driverLocationHandler = ({ driverId, lat, lng, bearing, speed }) => {
        if (driverIdRef.current && String(driverIdRef.current) === String(driverId)) {
          setDriverLocation({ lat, lng, bearing, speed });
        }
      };
      driverLocationRef.current = driverLocationHandler;
      socket.on('driver:locationUpdate', driverLocationHandler);

      socket.on(bookingEvent, (data) => {
        clearTimeout(timeoutRef.current);
        clearInterval(countdownRef.current);
        socket.off(bookingEvent);
        if (data.action === 'accept' && data.driver) {
          setDriver(data.driver);
          driverIdRef.current = data.driver.driverId;
          setBooking('found');
        } else if (data.action === 'decline') {
          // Driver declined — keep searching, don't cancel yet
        } else if (data.action === 'cancelled') {
          setBooking(null);
        }
      });
      countdownRef.current = setInterval(() => {
        setCountdown(prev => { if (prev <= 1) { clearInterval(countdownRef.current); return 0; } return prev - 1; });
      }, 1000);
      timeoutRef.current = setTimeout(async () => {
        clearInterval(countdownRef.current);
        socket.off(bookingEvent);
        if (driverLocationRef.current) {
          socket.off('driver:locationUpdate', driverLocationRef.current);
          driverLocationRef.current = null;
        }
        try { await api.cancelBooking(b.id, getToken()); } catch {}
        setBooking('timeout');
      }, TIMEOUT_SECONDS * 1000);
    } catch (err) {
      setBooking(null);
      alert(err.message?.includes('Missing') ? 'Please fill all details.' : 'Unable to connect. Check your connection.');
    }
  };

  // ── Open Razorpay checkout ───────────────────────────────────
  const openRazorpay = async () => {
    setPayLoading(true);
    const loaded = await loadRazorpay();
    if (!loaded) {
      setPayLoading(false);
      alert('Payment service unavailable. Please use Cash.');
      return;
    }
    const fareAmount = fare?.amount || 50;
    try {
      // Ask backend to create a Razorpay order
      const order = await api.createPaymentOrder({ amount: fareAmount, currency: 'INR' }, getToken());
      const options = {
        key:         RAZORPAY_KEY_ID,
        amount:      order.amount,
        currency:    order.currency || 'INR',
        name:        'MoveOn Go',
        description: `${TYPES.find(t => t.id === type)?.label} · ${pickup} → ${dropoff}`,
        order_id:    order.id,
        theme:       { color: '#0D47A1' },
        modal: {
          ondismiss: () => setPayLoading(false),
        },
        handler: async (response) => {
          setPayLoading(false);
          await startBooking(response);
        },
      };
      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', () => {
        setPayLoading(false);
        alert('Payment failed. Please try again or use Cash.');
      });
      rzp.open();
    } catch {
      setPayLoading(false);
      alert('Could not initiate payment. Please use Cash or check connection.');
    }
  };

  const handleBook = async () => {
    if (!pickup || !dropoff)             { alert('Please enter pickup and drop location'); return; }
    if (!pickupCoords || !dropoffCoords) { alert('Could not get coordinates. Try searching again.'); return; }
    if (payment === 'Cash') await startBooking();
    else await openRazorpay();
  };

  const handleCancel = async () => {
    clearTimeout(timeoutRef.current);
    clearInterval(countdownRef.current);
    if (riderLocationWatchRef.current) {
      riderLocationWatchRef.current();
      riderLocationWatchRef.current = null;
    }
    const socket = getSocket();
    if (socket && bookingId) {
      socket.off(`booking:${bookingId}`);
      if (driverLocationRef.current) {
        socket.off('driver:locationUpdate', driverLocationRef.current);
        driverLocationRef.current = null;
      }
    }
    if (bookingId) { try { await api.cancelBooking(bookingId, getToken()); } catch {} }
    setBooking(null); setBookingId(null); setDriver(null); setDriverLocation(null); setPayLoading(false);
  };

  // ── Searching ────────────────────────────────────────────────
  if (booking === 'searching') return (
    <div className="app">
      <Header title="Finding Driver" showBack onBack={handleCancel}/>
      <div className="page br-waiting">
        <div className="br-pulse-wrap">
          <div className="br-pulse-ring"/>
          <div className="br-pulse-ring br-pulse-ring--2"/>
          <span style={{fontSize:40}}>{TYPES.find(t=>t.id===type)?.emoji||'🚗'}</span>
        </div>
        <p className="br-waiting-title">Looking for a {type} near you...</p>
        <p className="br-waiting-sub">This may take a few seconds</p>
        <div style={{marginTop:16,fontSize:13,color:countdown<15?'var(--danger)':'var(--gray-400)',transition:'color 0.3s'}}>
          Cancelling in {countdown}s if no driver found
        </div>
        <button className="btn btn--ghost" style={{marginTop:24}} onClick={handleCancel}>Cancel</button>
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

  // ── Driver found ─────────────────────────────────────────────
  if (booking === 'found' && driver) return (
    <div className="app">
      <Header title="Driver Found"/>
      <div className="page" style={{padding:'24px 16px'}}>
        <div className="card br-driver-card slide-up">
          <div className="br-driver-top">
            <div className="br-driver-avatar">{driver.name?.[0]||'D'}</div>
            <div>
              <div className="br-driver-name">{driver.name}</div>
              <div className="br-driver-rating">⭐ {driver.rating||'4.5'} · {driver.vehicleNumber}</div>
            </div>
            <a href={`tel:${driver.phone}`} className="btn btn--secondary" style={{padding:'8px 14px',fontSize:13}}>Call</a>
          </div>
          <div className="divider"/>
          <div className="br-driver-eta">🕐 Arriving in {driver.eta||'3–5 min'}</div>
          <div className="br-driver-details">
            <span>📏 {route?.distanceKm} km</span>
            <span>⏱ {route?.durationMin} min</span>
            <span>💰 {fare?.display}</span>
            <span>💳 {payment}</span>
          </div>
          {driverLocation && (
            <div className="br-driver-location">
              🚗 Driver current position: {driverLocation.lat.toFixed(4)}, {driverLocation.lng.toFixed(4)}
            </div>
          )}
          {payment !== 'Cash' && (
            <div className="br-paid-badge">✅ Payment Confirmed via Razorpay</div>
          )}
        </div>
        <div style={{display:'flex',gap:12,marginTop:16}}>
          <button className="btn btn--secondary btn--lg" style={{flex:1}} onClick={() => navigate('/map')}>Track on Map</button>
          <button className="btn btn--danger btn--lg"    style={{flex:1}} onClick={handleCancel}>Cancel Ride</button>
        </div>
      </div>
      <BottomNav/>
    </div>
  );

  // ── Main screen ──────────────────────────────────────────────
  return (
    <div className="app">
      <Header title="Book a Ride" showBack onBack={() => navigate(-1)}/>
      <div className="page" style={{padding:'16px'}}>

        <p className="section-label" style={{padding:'0 0 8px'}}>Select Vehicle</p>
        <div style={{display:'flex',flexDirection:'column',gap:8,marginBottom:20}}>
          {TYPES.map(v => (
            <button key={v.id}
              className={`br-type-card card ${type===v.id?'br-type-card--selected':''}`}
              onClick={() => setType(v.id)}>
              <span style={{fontSize:22,marginRight:8}}>{v.emoji}</span>
              <div style={{flex:1}}>
                <div className="br-type-label">{v.label}</div>
                <div className="br-type-sub">{v.cap} · {v.eta}</div>
              </div>
              {type===v.id && <div className="br-type-check">✓</div>}
            </button>
          ))}
        </div>

        <p className="section-label" style={{padding:'0 0 8px'}}>Your Trip</p>
        <div className="card" style={{padding:14,marginBottom:14,overflow:'visible'}}>
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
          {[{id:'Cash',icon:'💵'},{id:'UPI',icon:'📱'},{id:'Card',icon:'💳'}].map(m => (
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
            🔒 Secure payment via Razorpay · UPI, Cards & Net Banking accepted
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
              :                     `Pay & Book · ${fare?.display||'Get Fare'}`
            }
          </button>
        </div>

      </div>
      <BottomNav/>
    </div>
  );
}