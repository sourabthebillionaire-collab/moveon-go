import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import BottomNav from '../components/BottomNav';
import PlaceSearch from '../components/PlaceSearch';
import { getCurrentPosition, reverseGeocode } from '../services/geocoding';
import { useAuth } from '../hooks/useAuth';
import api from '../services/api';
import { getToken } from '../services/storage';
import { useConfig } from '../context/ConfigContext';
import './Home.css';

const VEHICLE_TYPES = [
  { id: 'bus',  label: 'Bus',  sub: 'Track live buses',   icon: BusIcon,  path: '/buses'          },
  { id: 'auto', label: 'Auto', sub: 'Book auto rickshaw', icon: AutoIcon, path: '/book?type=auto' },
  { id: 'cab',  label: 'Cab',  sub: 'Book a cab',         icon: CabIcon,  path: '/book?type=cab'  },
];

export default function Home() {
  const navigate = useNavigate();
  const { user, updateUser } = useAuth();

  const [locLabel,   setLocLabel]   = useState('');
  const [locCoords,  setLocCoords]  = useState(null);
  const [locLoad,    setLocLoad]    = useState(true);
  const [locError,   setLocError]   = useState(false);
  const [dest,       setDest]       = useState('');
  const [destCoords, setDestCoords] = useState(null);
  const [tripCount,  setTripCount]  = useState(0);
  const dynamicConfig = useConfig();
  const [isAlertDismissed, setIsAlertDismissed] = useState(false);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  // Bug #2 & #3: Display user name if available; will be hydrated from backend via getProfile
  const firstName = user?.name?.split(' ')[0] || user?.phone?.slice(-4) || 'Guest';

  useEffect(() => {
    (async () => {
      try {
        const pos   = await getCurrentPosition();
        setLocCoords(pos);
        const label = await reverseGeocode(pos.lat, pos.lng);
        setLocLabel(label);
        setLocError(false);
      } catch (err) {
        setLocLabel('Location unavailable');
        setLocError(true);
        console.warn('[Home] Location error:', err.message);
      } finally {
        setLocLoad(false);
      }
    })();

    // Fetch trip count for stats
    const token = getToken();
    if (token) {
      api.getBookings(token)
        .then(d => setTripCount((d.bookings || []).length))
        .catch(() => {});
      
      // Bug #2 & #3 FIX: Hydrate full user profile to sync name/email immediately
      // This ensures greeting and profile page display correct user data on first load
      api.getProfile(token)
        .then(data => {
          if (data.user && updateUser) {
            updateUser(data.user);
          }
        })
        .catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (dynamicConfig?.alertId) {
      const dismissedId = localStorage.getItem('dismissed_alert_id');
      if (dismissedId === String(dynamicConfig.alertId)) setIsAlertDismissed(true);
    }
  }, [dynamicConfig]);

  const handleSearch = () => {
    if (destCoords) navigate('/map', { state: { from: locCoords, fromLabel: locLabel, to: destCoords, toLabel: dest } });
    else if (dest)  navigate('/buses', { state: { q: dest } });
    else            navigate('/map');
  };

  const refreshLocation = async () => {
    setLocLoad(true);
    setLocError(false);
    try {
      const pos   = await getCurrentPosition();
      setLocCoords(pos);
      const label = await reverseGeocode(pos.lat, pos.lng);
      setLocLabel(label);
      setLocError(false);
    } catch (err) {
      setLocLabel('Location unavailable');
      setLocError(true);
    } finally { setLocLoad(false); }
  };

  const dismissAlert = () => {
    if (dynamicConfig?.alertId) {
      localStorage.setItem('dismissed_alert_id', String(dynamicConfig.alertId));
      setIsAlertDismissed(true);
    }
  };

  const getAlertIcon = (severity) => {
    if (severity === 'critical') return '🚨';
    if (severity === 'warning') return '⚠️';
    return 'ℹ️';
  };

  return (
    <div className="app">
      <Header />
      <div className="page home-page">

        {/* Emergency Alert Banner */}
        {dynamicConfig?.alertMessage && !isAlertDismissed && (
          <div className={`home-alert slide-up home-alert--${dynamicConfig.alertSeverity || 'info'}`}>
            <div className="home-alert__content">
              <span className="home-alert__icon">
                {getAlertIcon(dynamicConfig.alertSeverity)}
              </span>
              <div className="home-alert__text">
                {dynamicConfig.alertMessage}
              </div>
            </div>
            <button className="home-alert__close" onClick={dismissAlert} aria-label="Dismiss alert">✕</button>
          </div>
        )}

        {/* ── Hero ──────────────────────────── */}
        <div className="home-hero">
          <div className="home-hero__top" style={{marginTop: '10px'}}>
            <div className="home-hero__text">
              <p className="home-hero__greet" style={{opacity: 0.8, fontSize: '14px', fontWeight: 500}}>{greeting},</p>
              <h1 className="home-hero__name" style={{fontSize: '28px', letterSpacing: '-0.5px'}}>{firstName}</h1>
              <p className="home-hero__sub" style={{marginTop: '4px', fontWeight: 500}}>Request a ride or track a vehicle</p>
            </div>
            <div className="home-hero__live">
              <span className="live-dot"/>
              <span style={{fontWeight: 700, fontSize: '11px'}}>LIVE</span>
            </div>
          </div>

          {/* Search card */}
          <div className="home-search" style={{borderRadius: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.08)', border: '1px solid var(--gray-200)', background: 'white'}}>
            <div className="home-search__row">
              <div className="home-search__dot home-search__dot--green"/>
              <div className="home-search__field">
                {locLoad ? (
                  <span className="home-search__detecting">
                    <span className="spinner" style={{width:12,height:12,borderWidth:1.5}}/>
                    Detecting location...
                  </span>
                ) : (
                  <span className="home-search__loc" title={locLabel}>
                    {locLabel || 'Current Location'}
                  </span>
                )}
              </div>
              <button className="home-search__gps" onClick={refreshLocation} disabled={locLoad}>
                <GpsIcon/>
              </button>
            </div>

            <div className="home-search__sep">
              <div className="home-search__sep-dots">
                <span/><span/><span/>
              </div>
              <div className="home-search__sep-line"/>
            </div>

            <div className="home-search__row">
              <div className="home-search__dot home-search__dot--red"/>
              <div className="home-search__field" style={{flex:1}}>
                <PlaceSearch
                  placeholder="Where to?"
                  value={dest}
                  onSelect={p => { if(p){setDestCoords(p);setDest(p.name);}else{setDestCoords(null);setDest('');} }}
                  dotColor="transparent"
                  hideDot
                />
              </div>
            </div>

            <button className="home-search__btn" onClick={handleSearch} style={{borderRadius: '12px', height: '52px', fontWeight: 700, transition: 'all 0.2s'}}>
              <SearchIcon/>
              Search Rides
            </button>
          </div>
        </div>

        {/* ── Stats strip ───────────────────── */}
        <div className="home-stats">
          {[
            { val: tripCount,      label: 'Total Rides', icon: '🚗' },
            { val: '4G',           label: 'Network',   icon: '📶' },
            { val: 'Live',         label: 'Tracking',  icon: '🛰️' },
          ].map((s, i) => (
            <div key={i} className="home-stat">
              <span className="home-stat__icon">{s.icon}</span>
              <span className="home-stat__val">{s.val}</span>
              <span className="home-stat__label">{s.label}</span>
            </div>
          ))}
        </div>

        {/* ── Vehicle types ─────────────────── */}
        <div className="home-section">
          <p className="home-section__label" style={{fontWeight: 700, fontSize: '14px', color: 'var(--gray-700)' }}>Available Services</p>
          <div className="home-vehicles">
            {VEHICLE_TYPES.map((v, i) => (
              <button 
                key={v.id} 
                className="home-veh" 
                onClick={() => {
                  window.navigator?.vibrate?.(15);
                  navigate(v.path);
                }} 
                style={{
                  borderRadius: '12px', 
                  transition: 'all 0.2s', 
                  padding: '16px'
                }}
              >
                <div className="home-veh__icon" style={{transform: 'scale(1.1)'}}><v.icon/></div>
                <div className="home-veh__label" style={{fontWeight: 700}}>{v.label}</div>
                <div className="home-veh__sub">{v.sub}</div>
                <div className="home-veh__arrow">→</div>
              </button>
            ))}
          </div>
        </div>

        {/* ── Quick access ──────────────────── */}
        <div className="home-section" style={{marginTop: '8px'}}>
          <p className="home-section__label">Quick Access</p>
          <div className="home-quick">
            {[
              { label: 'Ride History',  sub: 'View completed trips', path: '/history',    emoji: '📋', color: '#EEF4FF', dot: '#0D47A1' },
              { label: 'Saved Places',  sub: 'Manage destinations',  path: '/favourites', emoji: '🏠', color: '#FFF0F0', dot: '#DC2626' },
              { label: 'Live Map',      sub: 'View active vehicles', path: '/map',        emoji: '🗺️', color: '#E6F7EE', dot: '#00A046' },
              { label: 'Support',       sub: 'Access help center',   path: '/support',    emoji: '💬', color: '#FFFBE6', dot: '#E6A800' },
            ].map((q, i) => (
              <button 
                key={i} 
                className="home-quick-item"
                onClick={() => navigate(q.path)}
              >
                <div className="home-quick-item__icon" style={{background: q.color}}>
                  {q.emoji}
                </div>
                <div className="home-quick-item__text">
                  <div className="home-quick-item__label">{q.label}</div>
                  <div className="home-quick-item__sub">{q.sub}</div>
                </div>
                <div className="home-quick-item__arrow">›</div>
              </button>
            ))}
          </div>
        </div>

      </div>
      <BottomNav/>
    </div>
  );
}

function GpsIcon()    { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3" fill="currentColor"/><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/></svg>; }
function SearchIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>; }
function BusIcon()    { return <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><rect x="3" y="3" width="18" height="13" rx="2"/><path d="M3 11h18M8 19h8M10 19v-3m4 3v-3"/><circle cx="7" cy="16" r="1" fill="currentColor"/><circle cx="17" cy="16" r="1" fill="currentColor"/></svg>; }
function AutoIcon()   { return <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><path d="M5 11l1.5-4.5h11L19 11"/><path d="M3 11h18v6H3z"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/><path d="M3 13h18"/></svg>; }
function CabIcon()    { return <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><path d="M5 11l2-5h10l2 5"/><rect x="3" y="11" width="18" height="7" rx="1"/><circle cx="7.5" cy="18" r="1.5"/><circle cx="16.5" cy="18" r="1.5"/><path d="M3 14h18M9 6h6"/></svg>; }
