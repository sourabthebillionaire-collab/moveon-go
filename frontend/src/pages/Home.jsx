import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import BottomNav from '../components/BottomNav';
import PlaceSearch from '../components/PlaceSearch';
import { getCurrentPosition, reverseGeocode } from '../services/geocoding';
import { useAuth } from '../hooks/useAuth';
import './Home.css';

const VEHICLE_TYPES = [
  { id: 'bus',  label: 'Bus',  sub: 'Track live buses',    icon: BusIcon,  path: '/buses' },
  { id: 'auto', label: 'Auto', sub: 'Book auto rickshaw',  icon: AutoIcon, path: '/book?type=auto' },
  { id: 'cab',  label: 'Cab',  sub: 'Book a cab',          icon: CabIcon,  path: '/book?type=cab' },
  { id: 'bike', label: 'Bike', sub: 'Quick bike ride',     icon: BikeIcon, path: '/book?type=bike' },
];

export default function Home() {
  const navigate = useNavigate();
  const { user }  = useAuth();

  const [locLabel,  setLocLabel]  = useState('');
  const [locCoords, setLocCoords] = useState(null);
  const [locLoad,   setLocLoad]   = useState(true);
  const [dest,      setDest]      = useState('');
  const [destCoords,setDestCoords]= useState(null);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const firstName = user?.name?.split(' ')[0] || 'there';

  useEffect(() => {
    (async () => {
      try {
        const pos   = await getCurrentPosition();
        setLocCoords(pos);
        const label = await reverseGeocode(pos.lat, pos.lng);
        setLocLabel(label);
      } catch {
        setLocLabel('Location unavailable');
      } finally {
        setLocLoad(false);
      }
    })();
  }, []);

  const handleSearch = () => {
    if (destCoords) navigate('/map', { state: { from: locCoords, fromLabel: locLabel, to: destCoords, toLabel: dest } });
    else if (dest)  navigate('/buses', { state: { q: dest } });
    else            navigate('/map');
  };

  const refreshLocation = async () => {
    setLocLoad(true);
    try {
      const pos   = await getCurrentPosition();
      setLocCoords(pos);
      const label = await reverseGeocode(pos.lat, pos.lng);
      setLocLabel(label);
    } finally { setLocLoad(false); }
  };

  return (
    <div className="app">
      <Header />
      <div className="page home-page">

        {/* Hero */}
        <div className="home-hero">
          <div className="home-hero__top">
            <div>
              <p className="home-hero__greet">{greeting},</p>
              <h1 className="home-hero__title">{firstName}</h1>
              <p className="home-hero__sub">Where are you going?</p>
            </div>
            <div className="home-hero__live">
              <span className="live-dot" />
              <span>Live</span>
            </div>
          </div>

          {/* Search card */}
          <div className="home-search card">
            {/* From row */}
            <div className="home-search__from">
              <div className="home-search__from-dot" />
              <div className="home-search__from-label">
                {locLoad ? (
                  <span className="home-search__detecting">
                    <span className="spinner" style={{width:12,height:12,borderWidth:1.5,display:'inline-block',marginRight:6,verticalAlign:'middle'}}/>
                    Detecting location...
                  </span>
                ) : (
                  <span title={locLabel} className="home-search__loc">{locLabel || 'Current Location'}</span>
                )}
              </div>
              <button className="home-search__gps-btn" onClick={refreshLocation} disabled={locLoad} title="Refresh location">
                <GpsIcon />
              </button>
            </div>

            <div className="home-search__sep">
              <div className="home-search__sep-line" />
            </div>

            {/* To row */}
            <PlaceSearch
              placeholder="Enter destination"
              value={dest}
              onSelect={p => { if (p) { setDestCoords(p); setDest(p.name); } else { setDestCoords(null); setDest(''); } }}
              dotColor="var(--danger)"
            />

            <button className="btn btn--primary btn--full btn--lg home-search__go" onClick={handleSearch} style={{marginTop:12}}>
              Search
            </button>
          </div>
        </div>

        {/* Vehicle types */}
        <div className="home-body">
          <p className="section-label" style={{paddingTop:20}}>Choose Service</p>
          <div className="home-vehicles">
            {VEHICLE_TYPES.map(v => (
              <button key={v.id} className="home-veh card" onClick={() => navigate(v.path)}>
                <div className="home-veh__icon"><v.icon /></div>
                <div className="home-veh__label">{v.label}</div>
                <div className="home-veh__sub">{v.sub}</div>
              </button>
            ))}
          </div>

          {/* Quick links */}
          <p className="section-label">Quick Access</p>
          <div className="home-quick">
            {[
              { label: 'Trip History',  sub: 'Past rides',     path: '/history',    icon: '📋' },
              { label: 'Saved Places',  sub: 'Favourites',     path: '/favourites', icon: '⭐' },
              { label: 'Live Map',      sub: 'Track vehicles', path: '/map',        icon: '🗺️' },
              { label: 'Help',          sub: 'Support & FAQs', path: '/support',    icon: '❓' },
            ].map((q, i) => (
              <button key={i} className="home-quick__item card" onClick={() => navigate(q.path)}>
                <span className="home-quick__ico">{q.icon}</span>
                <div>
                  <div className="home-quick__label">{q.label}</div>
                  <div className="home-quick__sub">{q.sub}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

      </div>
      <BottomNav />
    </div>
  );
}

function GpsIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3" fill="currentColor"/><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/></svg>; }
function BusIcon()  { return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="3" width="18" height="13" rx="2"/><path d="M3 11h18M8 19h8M10 19v-3m4 3v-3"/><circle cx="7" cy="16" r="1" fill="currentColor"/><circle cx="17" cy="16" r="1" fill="currentColor"/></svg>; }
function AutoIcon() { return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M5 11l1.5-4.5h11L19 11"/><path d="M3 11h18v6H3z" rx="1"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/><path d="M3 13h18"/></svg>; }
function CabIcon()  { return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M5 11l2-5h10l2 5"/><rect x="3" y="11" width="18" height="7" rx="1"/><circle cx="7.5" cy="18" r="1.5"/><circle cx="16.5" cy="18" r="1.5"/><path d="M3 14h18"/><path d="M9 6h6"/></svg>; }
function BikeIcon() { return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="18.5" cy="17.5" r="3.5"/><path d="M15 6h-3l-3 8h9"/><path d="M5.5 17.5l5-8"/><circle cx="15" cy="6" r="1" fill="currentColor"/></svg>; }
