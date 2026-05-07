import { useState, useEffect, useCallback } from 'react';
import './NotifBanner.css';

// Global notification queue
const listeners = new Set();
let notifId = 0;

export function showNotification({ title, message, type = 'info', duration = 5000, action }) {
  const notif = { id: ++notifId, title, message, type, duration, action };
  listeners.forEach(cb => cb(notif));
}

export default function NotifBanner() {
  const [notifs, setNotifs] = useState([]);

  const add = useCallback((notif) => {
    setNotifs(prev => [notif, ...prev].slice(0, 3));
    if (notif.duration > 0) {
      setTimeout(() => remove(notif.id), notif.duration);
    }
  }, []);

  const remove = (id) => setNotifs(prev => prev.filter(n => n.id !== id));

  useEffect(() => {
    listeners.add(add);
    return () => listeners.delete(add);
  }, [add]);

  if (notifs.length === 0) return null;

  return (
    <div className="notif-stack">
      {notifs.map(notif => (
        <div key={notif.id} className={`notif-item notif-item--${notif.type} slide-up`}>
          <div className="notif-item__icon">
            {notif.type === 'success' ? '✓' :
             notif.type === 'error'   ? '✕' :
             notif.type === 'warning' ? '⚠' : 'ℹ'}
          </div>
          <div className="notif-item__body">
            {notif.title   && <div className="notif-item__title">{notif.title}</div>}
            {notif.message && <div className="notif-item__msg">{notif.message}</div>}
            {notif.action  && (
              <button className="notif-item__action" onClick={() => { notif.action.onClick(); remove(notif.id); }}>
                {notif.action.label}
              </button>
            )}
          </div>
          <button className="notif-item__close" onClick={() => remove(notif.id)}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}
