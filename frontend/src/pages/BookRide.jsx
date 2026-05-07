/* ── BookRide.jsx ── */
import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Header from '../components/Header';
import BottomNav from '../components/BottomNav';
import PlaceSearch from '../components/PlaceSearch';
import { getCurrentPosition, reverseGeocode } from '../services/geocoding';
import { getRoute, calcFare, fmtDist, fmtDuration } from '../services/routing';
import api from '../services/api';
import { addBooking, getToken } from '../services/storage';
import './BookRide.css';

const TYPES = [
  { id:'auto', label:'Auto Rickshaw', cap:'Up to 3 passengers', eta:'3–6 min' },
  { id:'cab',  label:'Cab',           cap:'Up to 4 passengers', eta:'5–8 min' },
  { id:'bike', label:'Bike',          cap:'1 passenger',        eta:'2–4 min' },
];

export default function BookRide() {
  const navigate = useNavigate();
  const [sp] = useSearchParams();
  const [type, setType] = useState(sp.get('type') || 'auto');
  const [pickup,       setPickup]       = useState('');
  const [pickupCoords, setPickupCoords] = useState(null);
  const [dropoff,      setDropoff]      = useState('');
  const [dropoffCoords,setDropoffCoords]= useState(null);
  const [route,        setRoute]        = useState(null);
  const [fare,         setFare]         = useState(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [payment,      setPayment]      = useState('Cash');
  const [booking,      setBooking]      = useState(null);
  const [driver,       setDriver]       = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const pos = await getCurrentPosition();
        setPickupCoords(pos);
        setPickup(await reverseGeocode(pos.lat, pos.lng));
      } catch { setPickup('Current Location'); }
    })();
  }, []);

  useEffect(() => {
    if (!pickupCoords || !dropoffCoords) { setRoute(null); setFare(null); return; }
    (async () => {
      setRouteLoading(true);
      try {
        // Try backend fare first
        const f = await api.getFareEstimate(pickupCoords, dropoffCoords, type);
        const r = await getRoute(pickupCoords, dropoffCoords);
        setRoute(r);
        setFare({ min: f.min, max: f.max, display: `₹${f.min}–₹${f.max}` });
      } catch {
        const r = await getRoute(pickupCoords, dropoffCoords);
        if (r) { setRoute(r); setFare(calcFare(r.distanceKm, type)); }
      } finally { setRouteLoading(false); }
    })();
  }, [pickupCoords, dropoffCoords, type]);

  const handleBook = async () => {
    if (!pickup || !dropoff) { alert('Please enter pickup and drop location'); return; }
    setBooking('searching');
    const bk = { type, pickup, pickupCoords, dropoff, dropoffCoords, fare: fare?.display, payment, distance: route?.distanceKm ? `${route.distanceKm} km` : '--', duration: route?.durationMin ? `${route.durationMin} min` : '--' };
    try {
      const { booking: b, driver: d } = await api.createBooking(bk, getToken());
      addBooking(b);
      setDriver(d);
      setBooking('found');
    } catch {
      // Backend not connected — stay in searching state
      setTimeout(() => { setBooking(null); alert('Unable to connect to server. Please check your internet connection.'); }, 4000);
    }
  };

  if (booking === 'searching') return (
    <div className="app"><Header title="Finding Driver" showBack onBack={() => setBooking(null)} />
      <div className="page br-waiting">
        <div className="br-pulse-wrap">
          <div className="br-pulse-ring"/><div className="br-pulse-ring br-pulse-ring--2"/>
          <span style={{fontSize:36}}>{type==='auto'?'🛺':type==='cab'?'🚕':'🏍️'}</span>
        </div>
        <p className="br-waiting-title">Looking for a {type} near you...</p>
        <p className="br-waiting-sub">This may take a few seconds</p>
        <button className="btn btn--ghost" style={{marginTop:24}} onClick={() => setBooking(null)}>Cancel</button>
      </div>
    </div>
  );

  if (booking === 'found' && driver) return (
    <div className="app"><Header title="Driver Found" />
      <div className="page" style={{padding:'24px 16px'}}>
        <div className="card br-driver-card slide-up">
          <div className="br-driver-top">
            <div className="br-driver-avatar">{driver.name?.[0]||'D'}</div>
            <div>
              <div className="br-driver-name">{driver.name}</div>
              <div className="br-driver-rating">⭐ {driver.rating} · {driver.vehicleNumber}</div>
            </div>
            <a href={`tel:${driver.phone}`} className="btn btn--secondary" style={{padding:'8px 14px',fontSize:13}}>Call</a>
          </div>
          <div className="divider"/>
          <div className="br-driver-eta">Arriving in {driver.eta}</div>
          <div className="br-driver-details">
            <span>📏 {route?.distanceKm} km</span>
            <span>⏱ {route?.durationMin} min</span>
            <span>💰 {fare?.display}</span>
            <span>💳 {payment}</span>
          </div>
        </div>
        <div style={{display:'flex',gap:12,marginTop:16}}>
          <button className="btn btn--secondary btn--lg" style={{flex:1}} onClick={() => navigate('/map')}>Track on Map</button>
          <button className="btn btn--danger btn--lg"    style={{flex:1}} onClick={() => setBooking(null)}>Cancel Ride</button>
        </div>
      </div>
      <BottomNav/>
    </div>
  );

  return (
    <div className="app"><Header title="Book a Ride" showBack onBack={() => navigate(-1)} />
      <div className="page" style={{padding:'16px'}}>
        <p className="section-label" style={{padding:'0 0 8px'}}>Select Vehicle</p>
        <div style={{display:'flex',flexDirection:'column',gap:8,marginBottom:20}}>
          {TYPES.map(v => (
            <button key={v.id} className={`br-type-card card ${type===v.id?'br-type-card--selected':''}`}
              onClick={() => setType(v.id)}>
              <div>
                <div className="br-type-label">{v.label}</div>
                <div className="br-type-sub">{v.cap} · {v.eta}</div>
              </div>
              {type===v.id && <div className="br-type-check">✓</div>}
            </button>
          ))}
        </div>

        <p className="section-label" style={{padding:'0 0 8px'}}>Your Trip</p>
        <div className="card" style={{padding:14,marginBottom:14,overflow:'visible'}}>
          <PlaceSearch placeholder="Pickup location" value={pickup} onSelect={p => { if(p){setPickupCoords(p);setPickup(p.name);}else setPickupCoords(null); }} dotColor="var(--green-600)"/>
          <div style={{height:1,background:'var(--gray-200)',margin:'10px 0 10px 20px'}}/>
          <PlaceSearch placeholder="Drop location" value={dropoff} onSelect={p => { if(p){setDropoffCoords(p);setDropoff(p.name);}else setDropoffCoords(null); }} dotColor="var(--danger)"/>
        </div>

        {routeLoading && <div style={{display:'flex',alignItems:'center',gap:10,padding:'8px 0',color:'var(--gray-400)',fontSize:13}}><span className="spinner" style={{width:14,height:14,borderWidth:1.5}}/>Calculating route...</div>}

        {route && fare && !routeLoading && (
          <div className="card" style={{padding:14,marginBottom:14}}>
            {[[fmtDist(route.distance),'Distance'],[fmtDuration(route.duration),'Duration'],[fare.display,'Fare Estimate']].map(([v,l],i,a) => (
              <div key={i}><div style={{display:'flex',justifyContent:'space-between',padding:'6px 0',fontSize:13}}><span style={{color:'var(--gray-500)'}}>{l}</span><strong style={{color:i===2?'var(--green-600)':'var(--gray-900)'}}>{v}</strong></div>{i<a.length-1&&<div className="divider"/>}</div>
            ))}
          </div>
        )}

        <p className="section-label" style={{padding:'0 0 8px'}}>Payment</p>
        <div style={{display:'flex',gap:8,marginBottom:24}}>
          {['Cash','UPI','Card'].map(m => (
            <button key={m} className={`chip ${payment===m?'active':''}`} style={{flex:1,justifyContent:'center',padding:'10px'}} onClick={() => setPayment(m)}>{m}</button>
          ))}
        </div>

        <button className="btn btn--primary btn--full btn--lg" onClick={handleBook} disabled={!pickup||!dropoff}>
          {!dropoff ? 'Enter Drop Location' : `Book ${TYPES.find(v=>v.id===type)?.label} · ${fare?.display||'Get Fare'}`}
        </button>
      </div>
      <BottomNav/>
    </div>
  );
}
