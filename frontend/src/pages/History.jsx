import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import BottomNav from '../components/BottomNav';
import { getTrips, clearTrips } from '../services/storage';
import './History.css';

const TYPE_LABEL = { bus: 'Bus', auto: 'Auto', cab: 'Cab', bike: 'Bike' };

function timeAgo(ts) {
  const d = Date.now() - ts;
  const m = Math.floor(d / 60000);
  if (m < 60)  return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(ts).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export default function History() {
  const navigate = useNavigate();
  const [trips, setTrips] = useState([]);

  useEffect(() => { setTrips(getTrips()); }, []);

  const totalSpent = trips
    .filter(t => t.status !== 'cancelled')
    .reduce((s, t) => s + parseInt((t.fare || '0').replace(/\D/g, '') || 0), 0);

  const handleClear = () => {
    if (!window.confirm('Clear all trip history?')) return;
    clearTrips();
    setTrips([]);
  };

  return (
    <div className="app">
      <Header title="Trip History" showBack onBack={() => navigate(-1)} />
      <div className="page">

        {/* Summary strip */}
        {trips.length > 0 && (
          <div className="hist-strip">
            <div className="hist-strip-item">
              <span className="hist-strip-val">{trips.length}</span>
              <span className="hist-strip-key">Total Trips</span>
            </div>
            <div className="hist-strip-div" />
            <div className="hist-strip-item">
              <span className="hist-strip-val">₹{totalSpent}</span>
              <span className="hist-strip-key">Total Spent</span>
            </div>
            <div className="hist-strip-div" />
            <div className="hist-strip-item">
              <span className="hist-strip-val">{trips.filter(t => t.status !== 'cancelled').length}</span>
              <span className="hist-strip-key">Completed</span>
            </div>
          </div>
        )}

        <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {trips.length === 0 ? (
            <div className="empty" style={{ paddingTop: 80 }}>
              <div className="empty__icon">📋</div>
              <div className="empty__title">No trips yet</div>
              <div className="empty__sub">Your completed trips will appear here</div>
              <button className="btn btn--primary" style={{ marginTop: 20 }} onClick={() => navigate('/book')}>
                Book a Ride
              </button>
            </div>
          ) : (
            <>
              {trips.map((trip, i) => (
                <div key={trip.id || i} className="card hist-card">
                  <div className="hist-card-top">
                    <div className="hist-type-badge">{TYPE_LABEL[trip.type] || 'Ride'}</div>
                    <div className="hist-route">
                      <span className="hist-from">{trip.pickup}</span>
                      <svg width="14" height="8" viewBox="0 0 24 12" fill="none"><path d="M0 6h20M14 1l6 5-6 5" stroke="currentColor" strokeWidth="2"/></svg>
                      <span className="hist-to">{trip.dropoff}</span>
                    </div>
                    <div className="hist-fare">{trip.fare}</div>
                  </div>
                  <div className="hist-card-btm">
                    <span className={`badge ${trip.status === 'cancelled' ? 'badge--red' : 'badge--green'}`}>
                      {trip.status === 'cancelled' ? 'Cancelled' : 'Completed'}
                    </span>
                    {trip.distance && <span className="hist-meta">{trip.distance}</span>}
                    {trip.duration && <span className="hist-meta">{trip.duration}</span>}
                    <span className="hist-time">{timeAgo(trip.ts)}</span>
                    {trip.status !== 'cancelled' && (
                      <button className="hist-rebook" onClick={() => navigate(`/book?type=${trip.type}`)}>
                        Rebook
                      </button>
                    )}
                  </div>
                </div>
              ))}
              <button className="btn btn--ghost btn--full" style={{ marginTop: 8, color: 'var(--danger)', fontSize: 13 }} onClick={handleClear}>
                Clear History
              </button>
            </>
          )}
        </div>
      </div>
      <BottomNav />
    </div>
  );
}
