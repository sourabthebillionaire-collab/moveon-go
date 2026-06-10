import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import './SideDrawer.css';

const NAV = [
  { path: '/',               label: 'Home',              icon: HomeIcon    },
  { path: '/buses',          label: 'Bus Tracker',       icon: BusIcon     },
  { path: '/map',            label: 'Live Map',          icon: MapIcon     },
  { path: '/book',           label: 'Book a Ride',       icon: BookIcon    },
  { path: '/history',        label: 'Trip History',      icon: HistoryIcon },
  { path: '/favourites',     label: 'Saved Places',      icon: StarIcon    },
  { path: '/driver',         label: 'Driver Panel',      icon: DriverIcon, divider: true },
  { path: '/driver-register',label: 'Register as Driver',icon: AddIcon     },
  { path: '/settings',       label: 'Settings',          icon: SettingsIcon, divider: true },
  { path: '/support',        label: 'Help & Support',    icon: SupportIcon },
  { path: '/privacy',        label: 'Privacy & Terms',   icon: LockIcon    },
];

export default function SideDrawer({ open, onClose }) {
  const navigate          = useNavigate();
  const location          = useLocation();
  const { user, logout }  = useAuth();

  // SYNC: Calculate initials with the same robust logic used in Profile.jsx
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
    if (user?.phone && typeof user.phone === 'string' && user.phone.length >= 2) {
      return user.phone.slice(-2).toUpperCase();
    }
    return 'U';
  })();

  const go = (path) => { navigate(path); onClose(); };

  return (
    <>
      {open && <div className="overlay" onClick={onClose} />}
      <aside className={`drawer ${open ? 'drawer--open' : ''}`}>

        {/* User info */}
        <div className="drawer__head">
          <div className="drawer__avatar">{initials}</div>
          <div className="drawer__user">
            <div className="drawer__name">{user?.name || 'Guest'}</div>
            <div className="drawer__phone">{user?.phone || ''}</div>
          </div>
          <button className="drawer__close" onClick={onClose}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {/* Nav */}
        <nav className="drawer__nav">
          {NAV.map((item, i) => {
            const Icon   = item.icon;
            const active = location.pathname === item.path;
            return (
              <div key={i}>
                {item.divider && <div className="divider" style={{ margin: '6px 0' }} />}
                <button
                  className={`drawer__item ${active ? 'drawer__item--active' : ''}`}
                  onClick={() => go(item.path)}
                >
                  <span className="drawer__item-icon"><Icon /></span>
                  <span className="drawer__item-label">{item.label}</span>
                  {active && <span className="drawer__item-bar" />}
                </button>
              </div>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="drawer__foot">
          {user ? (
            <button className="btn btn--danger btn--full" style={{ fontSize: 13 }}
              onClick={() => { logout(); onClose(); navigate('/login'); }}>
              Sign Out
            </button>
          ) : (
            <button className="btn btn--primary btn--full" style={{ fontSize: 13 }}
              onClick={() => go('/login')}>
              Sign In
            </button>
          )}
          <p className="drawer__version">MoveOn Go · v1.0.0</p>
        </div>
      </aside>
    </>
  );
}

function HomeIcon()      { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>; }
function BusIcon()       { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="13" rx="2"/><path d="M3 11h18M8 19h8M10 19v-3m4 3v-3"/><circle cx="7" cy="16" r="1" fill="currentColor"/><circle cx="17" cy="16" r="1" fill="currentColor"/></svg>; }
function MapIcon()       { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>; }
function BookIcon()      { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M12 8v8M8 12h8"/></svg>; }
function HistoryIcon()   { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>; }
function StarIcon()      { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>; }
function DriverIcon()    { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 7H4a2 2 0 00-2 2v6a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2z"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/></svg>; }
function AddIcon()       { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>; }
function SettingsIcon()  { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>; }
function SupportIcon()   { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3M12 17h.01"/></svg>; }
function LockIcon()      { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>; }
