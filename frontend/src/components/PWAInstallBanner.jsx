import { useState, useEffect } from 'react';
import './PWAInstallBanner.css';

export default function PWAInstallBanner() {
  const [canInstall, setCanInstall] = useState(false);
  const [installed, setInstalled]   = useState(false);
  const [dismissed, setDismissed]   = useState(
    () => localStorage.getItem('pwa-banner-dismissed') === 'true'
  );

  useEffect(() => {
    // Check if already running as installed PWA
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setInstalled(true);
      return;
    }

    // Listen for installable event from main.jsx
    const onInstallable = () => setCanInstall(true);
    const onInstalled   = () => { setInstalled(true); setCanInstall(false); };

    window.addEventListener('pwa-installable', onInstallable);
    window.addEventListener('pwa-installed',   onInstalled);

    // If prompt already fired before component mounted
    if (window.deferredInstallPrompt) setCanInstall(true);

    return () => {
      window.removeEventListener('pwa-installable', onInstallable);
      window.removeEventListener('pwa-installed',   onInstalled);
    };
  }, []);

  const handleInstall = async () => {
    const accepted = await window.triggerPWAInstall?.();
    if (accepted) setInstalled(true);
  };

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem('pwa-banner-dismissed', 'true');
  };

  // Don't show if: already installed, dismissed, or not installable
  if (installed || dismissed || !canInstall) return null;

  return (
    <div className="pwa-banner">
      <div className="pwa-banner-left">
        <img src="/logo.png" alt="MoveOn Go" className="pwa-banner-logo" />
        <div>
          <div className="pwa-banner-title">Install MoveOn Go</div>
          <div className="pwa-banner-sub">Add to home screen · Works offline</div>
        </div>
      </div>
      <div className="pwa-banner-right">
        <button className="pwa-install-btn" onClick={handleInstall}>Install</button>
        <button className="pwa-dismiss-btn" onClick={handleDismiss}>✕</button>
      </div>
    </div>
  );
}
