import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import BottomNav from '../components/BottomNav';
import { useAuth } from '../hooks/useAuth';
import api from '../services/api';
import { getToken, getFavourites } from '../services/storage';
import './Profile.css';

const MENU = [
  { label: 'Trip History',    sub: 'View all your past rides',  path: '/history',    icon: '📋' },
  { label: 'Saved Places',    sub: 'Your favourite locations',  path: '/favourites', icon: '❤️' },
  { label: 'Settings',        sub: 'Preferences & account',     path: '/settings',   icon: '⚙️' },
  { label: 'Privacy & Terms', sub: 'Data usage & legal info',   path: '/privacy',    icon: '🔒' },
  { label: 'Help & Support',  sub: 'FAQs & contact us',         path: '/support',    icon: '💬' },
];

export default function Profile() {
  const navigate          = useNavigate();
  const { user, logout, updateUser } = useAuth();

  const [editing,   setEditing]   = useState(false);
  const [name,      setName]      = useState(user?.name  || '');
  const [email,     setEmail]     = useState(user?.email || '');
  const [saving,    setSaving]    = useState(false);
  const [saveErr,   setSaveErr]   = useState('');
  const [saveOk,    setSaveOk]    = useState(false);
  const [tripCount, setTripCount] = useState(0);
  const [adminTap,  setAdminTap]  = useState(0);

  const favCount = getFavourites().length;

  // ✅ Fetch real trip count from backend
  useEffect(() => {
    const token = getToken();
    if (!token) return;
    api.getBookings(token)
      .then(data => setTripCount((data.bookings || []).length))
      .catch(() => {});
  }, []);

  // ✅ Actually save to backend
  const handleSave = async () => {
    setSaveErr(''); setSaveOk(false);
    if (!name.trim()) { setSaveErr('Name cannot be empty.'); return; }
    setSaving(true);
    try {
      const token = getToken();
      const data  = await api.updateProfile({ name: name.trim(), email: email.trim() }, token);
      if (updateUser) updateUser(data.user); // update auth context
      setSaveOk(true);
      setTimeout(() => { setSaveOk(false); setEditing(false); }, 1200);
    } catch (err) {
      setSaveErr(err.message || 'Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const handleVersionTap = () => {
    setAdminTap(prev => Math.min(prev + 1, 5));
  };

  const initials = (user?.name || 'U')
    .split(' ')
    .map(w => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="app">
      <Header title="Profile" />
      <div className="page prf2-page">

        {/* ── Hero ─────────────────────────── */}
        <div className="prf2-hero">
          <div className="prf2-avatar">
            <div className="prf2-avatar__initials">{initials}</div>
            <div className="prf2-avatar__ring"/>
          </div>

          {!editing ? (
            <>
              <div className="prf2-name">{user?.name || 'User'}</div>
              <div className="prf2-phone">📱 {user?.phone || '—'}</div>
              {user?.email && (
                <div className="prf2-email">✉️ {user.email}</div>
              )}
              <button className="prf2-edit-btn" onClick={() => { setEditing(true); setSaveErr(''); setSaveOk(false); }}>
                ✏️ Edit Profile
              </button>
            </>
          ) : (
            <div className="prf2-edit-form">
              <div className="prf2-edit-field">
                <label>Full Name</label>
                <input className="prf2-input" value={name}
                  onChange={e => { setName(e.target.value); setSaveErr(''); }}
                  placeholder="Your full name" autoFocus/>
              </div>
              <div className="prf2-edit-field">
                <label>Email <span style={{color:'#94A3B8',fontWeight:400}}>(optional)</span></label>
                <input className="prf2-input" type="email" value={email}
                  onChange={e => { setEmail(e.target.value); setSaveErr(''); }}
                  placeholder="your@email.com"/>
              </div>
              {saveErr && (
                <div className="prf2-save-err">⚠️ {saveErr}</div>
              )}
              {saveOk && (
                <div className="prf2-save-ok">✓ Profile updated!</div>
              )}
              <div className="prf2-edit-actions">
                <button className="prf2-btn prf2-btn--ghost"
                  onClick={() => { setEditing(false); setName(user?.name||''); setEmail(user?.email||''); setSaveErr(''); }}>
                  Cancel
                </button>
                <button className="prf2-btn prf2-btn--primary" onClick={handleSave} disabled={saving}>
                  {saving ? <><span className="prf2-spinner"/>Saving...</> : 'Save Changes'}
                </button>
              </div>
            </div>
          )}

          {/* Stats */}
          <div className="prf2-stats">
            <div className="prf2-stat">
              <span className="prf2-stat__val">{tripCount}</span>
              <span className="prf2-stat__key">Trips</span>
            </div>
            <div className="prf2-stat__div"/>
            <div className="prf2-stat">
              <span className="prf2-stat__val">{favCount}</span>
              <span className="prf2-stat__key">Saved</span>
            </div>
            <div className="prf2-stat__div"/>
            <div className="prf2-stat">
              <span className="prf2-stat__val">{user?.rating || '—'}</span>
              <span className="prf2-stat__key">Rating</span>
            </div>
          </div>
        </div>

        {/* ── Menu ─────────────────────────── */}
        <div className="prf2-section">
          <div className="prf2-card">
            {MENU.map((item, i) => (
              <div key={i}>
                <button className="prf2-menu-item" onClick={() => navigate(item.path)}>
                  <div className="prf2-menu-item__icon">{item.icon}</div>
                  <div className="prf2-menu-item__text">
                    <div className="prf2-menu-item__label">{item.label}</div>
                    <div className="prf2-menu-item__sub">{item.sub}</div>
                  </div>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <path d="M9 18l6-6-6-6"/>
                  </svg>
                </button>
                {i < MENU.length - 1 && <div className="prf2-divider"/>}
              </div>
            ))}
          </div>
        </div>

        {/* ── Sign out ─────────────────────── */}
        <div className="prf2-section">
          <button className="prf2-signout" onClick={handleLogout}>
            <span>Sign Out</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/>
            </svg>
          </button>
        </div>

        {/* ── Footer / secret admin ────────── */}
        <p className="prf2-version" onClick={handleVersionTap}>
          MoveOn Go · v1.0.0 · Made in Odisha 🇮🇳
        </p>

        {adminTap >= 5 && (
          <div className="prf2-section" style={{paddingTop:0}}>
            <button className="prf2-admin-btn" onClick={() => navigate('/admin')}>
              🔐 Admin Panel
            </button>
          </div>
        )}

      </div>
      <BottomNav/>
    </div>
  );
}
