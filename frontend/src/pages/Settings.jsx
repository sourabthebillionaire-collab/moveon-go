import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import BottomNav from '../components/BottomNav';
import './Settings.css';

function Toggle({ on, onChange }) {
  return (
    <div className={`stg-toggle ${on ? 'on' : ''}`} onClick={() => onChange(!on)}>
      <div className="stg-ball" />
    </div>
  );
}

export default function Settings() {
  const navigate = useNavigate();
  const [notif,  setNotif]  = useState(true);
  const [gps,    setGps]    = useState(true);
  const [lang,   setLang]   = useState('English');
  const [unit,   setUnit]   = useState('km');

  const sections = [
    {
      title: 'Notifications',
      items: [
        { label: 'Push Notifications', sub: 'Ride updates, bus alerts', type: 'toggle', val: notif, set: setNotif },
        { label: 'Live GPS Sharing',   sub: 'Share location during trips', type: 'toggle', val: gps, set: setGps },
      ],
    },
    {
      title: 'Preferences',
      items: [
        { label: 'Language', sub: lang, type: 'select' },
        { label: 'Distance Unit', sub: unit === 'km' ? 'Kilometres' : 'Miles', type: 'unit' },
      ],
    },
    {
      title: 'Account',
      items: [
        { label: 'Privacy & Terms',   sub: 'Data & legal info',   type: 'nav', path: '/privacy' },
        { label: 'Help & Support',    sub: 'FAQs & contact',      type: 'nav', path: '/support' },
        { label: 'App Version',       sub: 'v1.0.0 · Build 2026', type: 'info' },
      ],
    },
  ];

  return (
    <div className="app">
      <Header title="Settings" showBack onBack={() => navigate(-1)} />
      <div className="page" style={{ padding: '8px 16px 24px' }}>
        {sections.map((sec, si) => (
          <div key={si} style={{ marginBottom: 20 }}>
            <p className="section-label" style={{ padding: '12px 0 6px' }}>{sec.title}</p>
            <div className="card" style={{ overflow: 'hidden' }}>
              {sec.items.map((item, ii) => (
                <div key={ii}>
                  <div className="stg-row" onClick={() => item.type === 'nav' && navigate(item.path)}>
                    <div className="stg-text">
                      <div className="stg-label">{item.label}</div>
                      <div className="stg-sub">{item.sub}</div>
                    </div>
                    {item.type === 'toggle' && <Toggle on={item.val} onChange={item.set} />}
                    {item.type === 'select' && (
                      <select className="stg-select" value={lang} onChange={e => setLang(e.target.value)}>
                        {['English','Hindi','Odia','Tamil','Telugu'].map(l => <option key={l}>{l}</option>)}
                      </select>
                    )}
                    {item.type === 'unit' && (
                      <div className="stg-unit">
                        <button className={unit==='km'?'active':''} onClick={() => setUnit('km')}>km</button>
                        <button className={unit==='mi'?'active':''} onClick={() => setUnit('mi')}>mi</button>
                      </div>
                    )}
                    {item.type === 'nav' && (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M9 18l6-6-6-6"/>
                      </svg>
                    )}
                  </div>
                  {ii < sec.items.length - 1 && <div className="divider" style={{ margin: '0 16px' }} />}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <BottomNav />
    </div>
  );
}
