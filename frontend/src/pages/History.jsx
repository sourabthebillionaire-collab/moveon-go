import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import BottomNav from '../components/BottomNav';
import api from '../services/api';
import { getToken } from '../services/storage';
import './History.css';

const TYPE_META = {
  bus:  { emoji: '🚌', label: 'Bus',  color: '#1565C0', bg: '#E3F2FD' },
  auto: { emoji: '🛺', label: 'Auto', color: '#E65100', bg: '#FFF3E0' },
  cab:  { emoji: '🚕', label: 'Cab',  color: '#1B5E20', bg: '#E8F5E9' },
  bike: { emoji: '🏍️', label: 'Bike', color: '#4A148C', bg: '#F3E5F5' },
};

const STATUS_META = {
  completed: { label: 'Completed', color: '#00A046', bg: '#E6F4EC' },
  cancelled: { label: 'Cancelled', color: '#D32F2F', bg: '#FFEBEE' },
  searching: { label: 'Searching', color: '#F57C00', bg: '#FFF3E0' },
  accepted:  { label: 'Accepted',  color: '#1565C0', bg: '#E3F2FD' },
  started:   { label: 'Ongoing',   color: '#6A1B9A', bg: '#F3E5F5' },
};

function formatDate(dateStr) {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now - d;
  const mins = Math.floor(diff / 60000);
  const hrs  = Math.floor(mins / 60);
  const days = Math.floor(hrs / 24);
  if (mins < 60)  return `${mins}m ago`;
  if (hrs  < 24)  return `${hrs}h ago`;
  if (days < 7)   return `${days}d ago`;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: days > 365 ? 'numeric' : undefined });
}

function Skeleton() {
  return (
    <div className="hist2-skeleton">
      {[1,2,3].map(i => (
        <div key={i} className="hist2-skeleton__card">
          <div className="hist2-skeleton__row">
            <div className="hist2-skeleton__badge"/>
            <div className="hist2-skeleton__line hist2-skeleton__line--lg"/>
            <div className="hist2-skeleton__line hist2-skeleton__line--sm"/>
          </div>
          <div className="hist2-skeleton__line hist2-skeleton__line--md" style={{marginTop:8}}/>
          <div className="hist2-skeleton__line hist2-skeleton__line--sm" style={{marginTop:6}}/>
        </div>
      ))}
    </div>
  );
}

export default function History() {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState('');
  const [filter,   setFilter]   = useState('all'); // all | completed | cancelled

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError('');
      try {
        const token = getToken();
        // FIX: Ensure loading is stopped even on early exit
        if (!token) { setError('Please sign in to view history.'); setLoading(false); return; } 
        const data = await api.getBookings(token); // FIX: Ensure API call is awaited
        setBookings(data.bookings || []);
      } catch {
        setError('Could not load trip history. Check your connection.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = filter === 'all'
    ? bookings
    : bookings.filter(b => b.status === filter);

  const completed  = bookings.filter(b => b.status === 'completed');
  const totalSpent = completed.reduce((s, b) => s + (b.fareAmount || 0), 0);

  return (
    <div className="app">
      <Header title="Trip History" showBack onBack={() => navigate(-1)} />
      <div className="page hist2-page">

        {/* ── Summary strip ─────────────────── */}
        {!loading && bookings.length > 0 && (
          <div className="hist2-strip">
            <div className="hist2-strip__item">
              <span className="hist2-strip__val">{bookings.length}</span>
              <span className="hist2-strip__key">Total Trips</span>
            </div>
            <div className="hist2-strip__div"/>
            <div className="hist2-strip__item">
              <span className="hist2-strip__val">₹{totalSpent}</span>
              <span className="hist2-strip__key">Total Spent</span>
            </div>
            <div className="hist2-strip__div"/>
            <div className="hist2-strip__item">
              <span className="hist2-strip__val">{completed.length}</span>
              <span className="hist2-strip__key">Completed</span>
            </div>
          </div>
        )}

        {/* ── Filter chips ──────────────────── */}
        {!loading && bookings.length > 0 && (
          <div className="hist2-filters">
            {['all','completed','cancelled'].map(f => (
              <button key={f}
                className={`hist2-chip ${filter === f ? 'active' : ''}`}
                onClick={() => setFilter(f)}>
                {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        )}

        {/* ── Loading ───────────────────────── */}
        {loading && <Skeleton/>}

        {/* ── Error ────────────────────────── */}
        {!loading && error && (
          <div className="hist2-error">
            <span>⚠️</span> {error}
          </div>
        )}

        {/* ── Empty state ───────────────────── */}
        {!loading && !error && filtered.length === 0 && (
          <div className="hist2-empty">
            <div className="hist2-empty__emoji">
              {filter === 'cancelled' ? '❌' : '🛺'}
            </div>
            <div className="hist2-empty__title">
              {filter === 'all' ? 'No trips yet' : `No ${filter} trips`}
            </div>
            <div className="hist2-empty__sub">
              {filter === 'all'
                ? 'Your completed trips will appear here'
                : `You have no ${filter} trips`}
            </div>
            {filter === 'all' && (
              <button className="btn btn--primary" style={{marginTop:20}}
                onClick={() => navigate('/book')}>
                Book Your First Ride
              </button>
            )}
          </div>
        )}

        {/* ── Trip list ────────────────────── */}
        {!loading && !error && filtered.length > 0 && (
          <div className="hist2-list">
            {filtered.map((b, i) => {
              const meta   = TYPE_META[b.vehicleType]   || TYPE_META.auto;
              const status = STATUS_META[b.status]      || STATUS_META.completed;
              return (
                <div key={b._id || i} className="hist2-card">
                  {/* Top row */}
                  <div className="hist2-card__top">
                    <div className="hist2-card__badge"
                      style={{background: meta.bg, color: meta.color}}>
                      {meta.emoji} {meta.label}
                    </div>
                    <div className="hist2-card__fare">
                      {b.fareAmount ? `₹${b.fareAmount}` : b.fare || '—'}
                    </div>
                  </div>

                  {/* Route */}
                  <div className="hist2-card__route">
                    <div className="hist2-card__route-row">
                      <div className="hist2-card__dot hist2-card__dot--green"/>
                      <span className="hist2-card__place">{b.pickup}</span>
                    </div>
                    <div className="hist2-card__route-line"/>
                    <div className="hist2-card__route-row">
                      <div className="hist2-card__dot hist2-card__dot--red"/>
                      <span className="hist2-card__place">{b.dropoff}</span>
                    </div>
                  </div>

                  {/* Bottom row */}
                  <div className="hist2-card__bottom">
                    <span className="hist2-card__status"
                      style={{background: status.bg, color: status.color}}>
                      {status.label}
                    </span>
                    {b.distance && (
                      <span className="hist2-card__meta">📏 {b.distance}</span>
                    )}
                    {b.duration && (
                      <span className="hist2-card__meta">⏱ {b.duration}</span>
                    )}
                    <span className="hist2-card__time">
                      {formatDate(b.createdAt)}
                    </span>
                    {b.status === 'completed' && (
                      <button className="hist2-card__rebook"
                        onClick={() => navigate(`/book?type=${b.vehicleType}`)}>
                        Rebook
                      </button>
                    )}
                  </div>

                  {/* Payment method */}
                  {b.payment && (
                    <div className="hist2-card__payment">
                      💳 Paid via {b.payment}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

      </div>
      <BottomNav/>
    </div>
  );
}
