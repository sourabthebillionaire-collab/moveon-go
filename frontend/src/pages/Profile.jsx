import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import BottomNav from '../components/BottomNav';
import { useAuth } from '../hooks/useAuth';
import { getTrips, getFavourites } from '../services/storage';
import './Profile.css';

export default function Profile() {
  const navigate  = useNavigate();
  const { user, logout } = useAuth();
  const [editing, setEditing] = useState(false);
  const [name,    setName]    = useState(user?.name || '');
  const [email,   setEmail]   = useState(user?.email || '');

  const tripCount = getTrips().length;
  const favCount  = getFavourites().length;

  const menu = [
    { label: 'Trip History',     sub: `${tripCount} trips`,       path: '/history'    },
    { label: 'Saved Places',     sub: `${favCount} saved`,        path: '/favourites' },
    { label: 'Settings',         sub: 'Preferences & account',    path: '/settings'   },
    { label: 'Privacy & Terms',  sub: 'Data usage & legal',       path: '/privacy'    },
    { label: 'Help & Support',   sub: 'FAQs, contact us',         path: '/support'    },
  ];

  const handleSave = () => {
    // TODO: call api.updateProfile when backend ready
    setEditing(false);
  };

  return (
    <div className="app">
      <Header title="Profile" />
      <div className="page">

        {/* Hero */}
        <div className="prf-hero">
          <div className="prf-avatar">{user?.name?.[0] || 'U'}</div>
          {editing ? (
            <div className="prf-edit-form">
              <input className="input" value={name}  onChange={e => setName(e.target.value)}  placeholder="Full Name" style={{ marginBottom: 8 }} />
              <input className="input" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email Address" />
              <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                <button className="btn btn--ghost" style={{ flex: 1 }} onClick={() => setEditing(false)}>Cancel</button>
                <button className="btn btn--primary" style={{ flex: 1 }} onClick={handleSave}>Save</button>
              </div>
            </div>
          ) : (
            <>
              <div className="prf-name">{user?.name || 'User'}</div>
              <div className="prf-phone">{user?.phone || ''}</div>
              <button className="btn btn--ghost" style={{ fontSize: 12, padding: '6px 16px', marginTop: 8, color: 'var(--blue-700)' }}
                onClick={() => setEditing(true)}>
                Edit Profile
              </button>
            </>
          )}

          <div className="prf-stats">
            <div className="prf-stat">
              <span className="prf-stat-val">{tripCount}</span>
              <span className="prf-stat-key">Trips</span>
            </div>
            <div className="prf-stat-div" />
            <div className="prf-stat">
              <span className="prf-stat-val">{favCount}</span>
              <span className="prf-stat-key">Saved</span>
            </div>
            <div className="prf-stat-div" />
            <div className="prf-stat">
              <span className="prf-stat-val">{user?.rating || '—'}</span>
              <span className="prf-stat-key">Rating</span>
            </div>
          </div>
        </div>

        {/* Menu */}
        <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 0 }}>
          <div className="card" style={{ overflow: 'hidden' }}>
            {menu.map((item, i) => (
              <div key={i}>
                <button className="prf-menu-item" onClick={() => navigate(item.path)}>
                  <div>
                    <div className="prf-menu-label">{item.label}</div>
                    <div className="prf-menu-sub">{item.sub}</div>
                  </div>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 18l6-6-6-6"/>
                  </svg>
                </button>
                {i < menu.length - 1 && <div className="divider" style={{ margin: '0 16px' }} />}
              </div>
            ))}
          </div>

          <button className="btn btn--danger btn--full" style={{ marginTop: 16 }}
            onClick={() => { logout(); navigate('/'); }}>
            Sign Out
          </button>
          <p style={{ textAlign: 'center', fontSize: 11, color: 'var(--gray-400)', marginTop: 12 }}>
            MoveOn Go · v1.0.0 · Made in India
          </p>
        </div>
      </div>
      <BottomNav />
    </div>
  );
}
