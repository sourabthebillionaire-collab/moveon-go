import { NavLink } from 'react-router-dom';
import './BottomNav.css';

const TABS = [
  { path: '/',      label: 'Home',  exact: true,  Icon: HomeIcon },
  { path: '/buses', label: 'Buses', Icon: BusIcon },
  { path: '/map',   label: 'Map',   Icon: MapIcon },
  { path: '/book',  label: 'Book',  Icon: BookIcon },
  { path: '/profile',label:'Profile',Icon: ProfileIcon },
];

export default function BottomNav() {
  return (
    <nav className="bottom-nav">
      {TABS.map(tab => (
        <NavLink key={tab.path} to={tab.path} end={tab.exact}
          className={({ isActive }) => `bnav-tab ${isActive ? 'bnav-tab--active' : ''}`}>
          {({ isActive }) => (
            <>
              <span className="bnav-icon"><tab.Icon active={isActive} /></span>
              <span className="bnav-label">{tab.label}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}

function HomeIcon({ active }) {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill={active?'currentColor':'none'} stroke="currentColor" strokeWidth="2">
    <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
    <polyline points="9 22 9 12 15 12 15 22" stroke="currentColor" fill="none"/>
  </svg>;
}
function BusIcon({ active }) {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill={active?'currentColor':'none'} stroke="currentColor" strokeWidth="2">
    <rect x="3" y="3" width="18" height="13" rx="2"/>
    <path d="M3 11h18M8 19h8M10 19v-3m4 3v-3"/>
    <circle cx="7" cy="16" r="1" fill="currentColor"/>
    <circle cx="17" cy="16" r="1" fill="currentColor"/>
  </svg>;
}
function MapIcon({ active }) {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill={active?'currentColor':'none'} stroke="currentColor" strokeWidth="2">
    <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/>
    <line x1="8" y1="2" x2="8" y2="18" stroke="currentColor"/>
    <line x1="16" y1="6" x2="16" y2="22" stroke="currentColor"/>
  </svg>;
}
function BookIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="3" width="18" height="18" rx="3"/>
    <path d="M12 8v8M8 12h8"/>
  </svg>;
}
function ProfileIcon({ active }) {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill={active?'currentColor':'none'} stroke="currentColor" strokeWidth="2">
    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
    <circle cx="12" cy="7" r="4"/>
  </svg>;
}
