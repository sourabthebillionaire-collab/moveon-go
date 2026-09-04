import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import BottomNav from '../components/BottomNav';
import { useAuth } from '../hooks/useAuth';
import api from '../services/api';
import { getToken, getFavourites } from '../services/storage';
import './Profile.css';

const MENU = [
  { label: 'Trip History',    sub: 'View all your past rides',    path: '/history',    icon: '🧾', bg: '#EEF4FF' },
  { label: 'Saved Places',    sub: 'Your favourite locations',    path: '/favourites', icon: '❤️', bg: '#FFF0F3' },
  { label: 'Settings',        sub: 'Preferences & notifications', path: '/settings',   icon: '⚙️', bg: '#F0FDF4' },
  { label: 'Privacy & Terms', sub: 'Data usage & legal info',     path: '/privacy',    icon: '🔒', bg: '#FFFBEB' },
  { label: 'Help & Support',  sub: 'FAQs & contact us',           path: '/support',    icon: '💬', bg: '#F5F3FF' },
];

export default function Profile() {
  const navigate = useNavigate();
  const { user, logout, updateUser } = useAuth();

  const [editing,   setEditing]   = useState(false);
  const [name,      setName]      = useState(user?.name  || '');
  const [phone,     setPhone]     = useState(user?.phone || '');
  const [saving,    setSaving]    = useState(false);
  const [saveErr,   setSaveErr]   = useState('');
  const [saveOk,    setSaveOk]    = useState(false);
  const [tripCount, setTripCount] = useState(0);
  const [adminTap,  setAdminTap]  = useState(0);
  const nameRef = useRef(null);

  const favCount = getFavourites().length;

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    
    // Fetch bookings for trip count
    api.getBookings(token)
      .then(d => setTripCount((d.bookings || []).length))
      .catch(() => {});

    // FIX Bug #3: Hydrate full user profile to sync name/email immediately
    api.getProfile(token)
      .then(data => {
        if (data.user) {
          if (updateUser) updateUser(data.user);
          setName(data.user.name || '');
          setPhone(data.user.phone || '');
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (editing) setTimeout(() => nameRef.current?.focus(), 100);
  }, [editing]);

  const startEdit = () => {
    setName(user?.name || '');
    setPhone(user?.phone || '');
    setSaveErr('');
    setSaveOk(false);
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setSaveErr('');
    setSaveOk(false);
  };

  const handleSave = async () => {
    setSaveErr(''); setSaveOk(false);
    if (!name.trim()) { setSaveErr('Name cannot be empty.'); return; }
    setSaving(true);
    try {
      const token = getToken();
      const data  = await api.updateProfile({ name: name.trim(), phone: phone.trim() }, token);
      if (updateUser) updateUser(data.user);
      setSaveOk(true);
      setTimeout(() => { setSaveOk(false); setEditing(false); }, 1000);
    } catch (err) {
      setSaveErr(err.message || 'Failed to save. Try again.');
    } finally { setSaving(false); }
  };

  const handleLogout = () => { logout(); navigate('/login'); };

  const initials = (() => {
    const namePart = user?.name?.trim();
    if (namePart) {
      const parts = namePart.split(/\s+/).filter(Boolean);
      if (parts.length > 0) {
        return parts.map(p => p[0])
          .slice(0, 2)
          .join('')
          .toUpperCase();
      }
    }
    if (user?.email && typeof user.email === 'string' && user.email.length >= 2) {
      return user.email.slice(0, 2).toUpperCase();
    }
    return 'U';
  })();

  const STATS = [
    { val: tripCount, label: 'Trips',  icon: '🛺' },
    { val: favCount,  label: 'Saved',  icon: '❤️' },
    { val: user?.rating || '—', label: 'Rating', icon: '⭐' },
  ];

  return (
    <div className="app">
      <Header title="Profile" />
      <div className="page prf-page">

        {/* ── HERO ─────────────────────────── */}
        <div className="prf-hero">
          {/* background decoration */}
          <div className="prf-hero__orb prf-hero__orb--a"/>
          <div className="prf-hero__orb prf-hero__orb--b"/>
          <div className="prf-hero__orb prf-hero__orb--c"/>

          {!editing ? (
            <>
              {/* Avatar */}
              <div className="prf-avatar">
                <div className="prf-avatar__glow"/>
                <div className="prf-avatar__circle">
                  <span className="prf-avatar__initials">{initials}</span>
                </div>
                <div className="prf-avatar__ring"/>
              </div>

              <h2 className="prf-name">{user?.name || 'User'}</h2>

              <div className="prf-contact">
                <span className="prf-contact__item">
                  <PhoneIcon/> {user?.phone || '—'}
                </span>
                {user?.email && (
                  <span className="prf-contact__item">
                    <MailIcon/> {user.email}
                  </span>
                )}
              </div>

              <button className="prf-edit-btn" onClick={startEdit}>
                <PencilIcon/> Edit Profile
              </button>

              {/* Stats */}
              <div className="prf-stats">
                {STATS.map((s, i) => (
                  <div key={i} className="prf-stat">
                    {i > 0 && <div className="prf-stat__sep"/>}
                    <div className="prf-stat__inner">
                      <span className="prf-stat__icon">{s.icon}</span>
                      <span className="prf-stat__val">{s.val}</span>
                      <span className="prf-stat__key">{s.label}</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            /* ── Edit form ── */
            <div className="prf-form">
              <div className="prf-form__title">
                <button className="prf-form__back" onClick={cancelEdit}>
                  <BackIcon/>
                </button>
                Edit Profile
              </div>

              <div className="prf-field">
                <label className="prf-field__label">Full Name</label>
                <input
                  ref={nameRef}
                  className="prf-input"
                  value={name}
                  onChange={e => { setName(e.target.value); setSaveErr(''); }}
                  placeholder="Your full name"
                />
              </div>

              <div className="prf-field">
                <label className="prf-field__label">
                  Phone <span className="prf-field__opt">(optional)</span>
                </label>
                <input
                  className="prf-input"
                  type="tel"
                  value={phone}
                  onChange={e => { setPhone(e.target.value); setSaveErr(''); }}
                  placeholder="Your phone number"
                />
              </div>

              {saveErr && <div className="prf-alert prf-alert--err">⚠️ {saveErr}</div>}
              {saveOk  && <div className="prf-alert prf-alert--ok">✓ Saved!</div>}

              <div className="prf-form__actions">
                <button className="prf-form__cancel" onClick={cancelEdit}>
                  Cancel
                </button>
                <button className="prf-form__save" onClick={handleSave} disabled={saving}>
                  {saving ? <><SpinnerIcon/> Saving…</> : 'Save Changes'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── MENU ─────────────────────────── */}
        <div className="prf-section">
          <div className="prf-card">
            {MENU.map((item, i) => (
              <div key={i}>
                <button className="prf-item" onClick={() => navigate(item.path)}>
                  <div className="prf-item__icon" style={{ background: item.bg }}>
                    {item.icon}
                  </div>
                  <div className="prf-item__text">
                    <span className="prf-item__label">{item.label}</span>
                    <span className="prf-item__sub">{item.sub}</span>
                  </div>
                  <ChevronIcon/>
                </button>
                {i < MENU.length - 1 && <div className="prf-rule"/>}
              </div>
            ))}
          </div>
        </div>

        {/* ── SIGN OUT ─────────────────────── */}
        <div className="prf-section">
          <button className="prf-signout" onClick={handleLogout}>
            <LogoutIcon/> Sign Out
          </button>
        </div>

        {/* ── VERSION / SECRET ADMIN ───────── */}
        <p
          className="prf-version"
          onClick={() => setAdminTap(p => Math.min(p + 1, 5))}>
          MoveOn Go · v1.0.0 · Made in Odisha 🇮🇳
        </p>

        {adminTap >= 5 && (
          <div className="prf-section prf-section--last">
            <button className="prf-admin" onClick={() => navigate('/admin')}>
              🔐 Admin Panel
            </button>
          </div>
        )}

      </div>
      <BottomNav/>
    </div>
  );
}

/* ── SVG Icons ── */
function PencilIcon() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>;
}
function PhoneIcon() {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 10.8a19.79 19.79 0 01-3.07-8.67A2 2 0 012 0h3a2 2 0 012 1.72c.13.96.36 1.9.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0122 16.92z"/></svg>;
}
function MailIcon() {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>;
}
function ChevronIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>;
}
function BackIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>;
}
function LogoutIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/></svg>;
}
function SpinnerIcon() {
  return <span className="prf-spinner"/>;
}
