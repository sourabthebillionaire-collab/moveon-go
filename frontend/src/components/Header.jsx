import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import SideDrawer from './SideDrawer';
import './Header.css';

export default function Header({ title, showBack, onBack, transparent }) {
  const [drawer, setDrawer] = useState(false);
  const navigate = useNavigate();

  return (
    <>
      <header className={`header ${transparent ? 'header--transparent' : ''}`}>
        <div className="header__left">
          {showBack ? (
            <button className="header__icon-btn" onClick={onBack || (() => navigate(-1))} aria-label="Back">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M19 12H5M12 5l-7 7 7 7"/>
              </svg>
            </button>
          ) : (
            <button className="header__icon-btn header__menu-btn" onClick={() => setDrawer(true)} aria-label="Menu">
              <span /><span /><span />
            </button>
          )}
        </div>

        <div className="header__center">
          {title ? (
            <span className="header__title">{title}</span>
          ) : (
            <div className="header__brand" onClick={() => navigate('/')}>
              <div className="header__logo-wrap">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="#0D47A1"/>
                  <circle cx="12" cy="9" r="2.5" fill="white"/>
                </svg>
              </div>
              <span className="header__brand-name">MoveOn<span>Go</span></span>
            </div>
          )}
        </div>

        <div className="header__right">
          <button className="header__icon-btn" onClick={() => navigate('/profile')} aria-label="Profile">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
          </button>
        </div>
      </header>

      <SideDrawer open={drawer} onClose={() => setDrawer(false)} />
    </>
  );
}
