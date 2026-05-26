// Privacy.jsx
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import BottomNav from '../components/BottomNav';

const SECTIONS = [
  { title: '1. Information We Collect', body: 'We collect your GPS location (only during active trips), phone number, name, and trip history. Location data is transmitted securely via encrypted WebSocket and is never stored permanently on our servers beyond session duration.' },
  { title: '2. How We Use Your Data', body: 'Your location is used to match you with nearby drivers and calculate real-time routes. Trip history is stored locally on your device. We do not sell or share your personal data with any third party.' },
  { title: '3. GPS & Location Tracking', body: 'Driver GPS is shared in real-time with passengers only during an active trip. Tracking stops automatically when a trip ends or the driver goes off duty. Passengers can see vehicle location, not driver identity.' },
  { title: '4. Data Security', body: 'All data transmissions use HTTPS and WSS (encrypted WebSocket). We use industry-standard encryption. You may request deletion of your account and all associated data at any time by contacting support.' },
  { title: '5. Your Rights', body: 'You have the right to access, correct, or delete your personal data. Contact support@moveon.in or call +91 73280 60281 to exercise these rights.' },
  { title: '6. Terms of Service', body: 'By using MoveOn Go you agree to use the service only for lawful purposes, provide accurate information, treat all drivers and passengers respectfully, and not abuse emergency (SOS) features. Violations may result in account suspension.' },
  { title: '7. Contact', body: 'For privacy concerns: support@moveon.in · +91 73280 60281\nThis policy was last updated: April 2026' },
];

export function Privacy() {
  const navigate = useNavigate();
  return (
    <div className="app">
      <Header title="Privacy & Terms" showBack onBack={() => navigate(-1)} />
      <div className="page" style={{ padding: '16px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {SECTIONS.map((s, i) => (
            <div key={i} className="card" style={{ padding: 16 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--blue-800)', marginBottom: 8 }}>{s.title}</p>
              <p style={{ fontSize: 13, color: 'var(--gray-500)', lineHeight: 1.7, whiteSpace: 'pre-line' }}>{s.body}</p>
            </div>
          ))}
          <div style={{ textAlign: 'center', padding: '8px 0 4px' }}>
            <a href="tel:+917328060281" style={{ display: 'block', padding: '12px', background: 'var(--green-100)', color: 'var(--green-700)', borderRadius: 'var(--radius-sm)', fontWeight: 700, textDecoration: 'none', marginBottom: 8 }}>
              📞 +91 73280 60281
            </a>
            <a href="mailto:support@moveon.in" style={{ display: 'block', padding: '12px', background: 'var(--blue-50)', color: 'var(--blue-800)', borderRadius: 'var(--radius-sm)', fontWeight: 700, textDecoration: 'none' }}>
              📧 support@moveon.in
            </a>
          </div>
        </div>
      </div>
      <BottomNav />
    </div>
  );
}

// Support.jsx
import { useState } from 'react';

const FAQS = [
  { q: 'How do I book a ride?',              a: 'Tap "Book a Ride" from the home screen, select your vehicle type, enter pickup and drop locations, then tap Book.' },
  { q: 'How does live bus tracking work?',   a: 'Buses with GPS-enabled devices share their location in real-time. Open Live Map to see all active buses near you. No data means no active buses right now.' },
  { q: 'How do I become a driver?',          a: 'Go to Settings → Driver Panel. Your Vehicle ID will be assigned by our admin. Contact us on the number below to register.' },
  { q: 'The map shows no vehicles?',         a: 'This means no drivers are currently online in your area. Vehicles appear automatically when drivers go on duty.' },
  { q: 'How is fare calculated?',            a: 'Auto: ₹25 base + ₹14/km. Cab: ₹60 + ₹16/km. Actual fare shown before booking.' },
  { q: 'GPS not detecting my location?',     a: 'Open your phone Settings → Apps → MoveOn Go → Permissions → Location → Allow all the time.' },
];

export function Support() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(null);
  const [report, setReport] = useState('');

  return (
    <div className="app">
      <Header title="Help & Support" showBack onBack={() => navigate(-1)} />
      <div className="page" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* Contact */}
        <div className="card" style={{ padding: 16 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--gray-900)', marginBottom: 12 }}>Contact Us</p>
          <a href="tel:+917328060281" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px', background: 'var(--green-100)', borderRadius: 'var(--radius-sm)', textDecoration: 'none', marginBottom: 8 }}>
            <span style={{ fontSize: 20 }}>📞</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--green-700)' }}>+91 73280 60281</div>
              <div style={{ fontSize: 11, color: 'var(--gray-400)' }}>Mon–Sat · 9AM–6PM</div>
            </div>
          </a>
          <a href="https://wa.me/917328060281" target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px', background: '#E8F5E9', borderRadius: 'var(--radius-sm)', textDecoration: 'none', marginBottom: 8 }}>
            <span style={{ fontSize: 20 }}>💬</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#2E7D32' }}>WhatsApp Us</div>
              <div style={{ fontSize: 11, color: 'var(--gray-400)' }}>Usually replies in 30 min</div>
            </div>
          </a>
          <a href="mailto:support@moveon.in" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px', background: 'var(--blue-50)', borderRadius: 'var(--radius-sm)', textDecoration: 'none' }}>
            <span style={{ fontSize: 20 }}>📧</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--blue-800)' }}>support@moveon.in</div>
              <div style={{ fontSize: 11, color: 'var(--gray-400)' }}>Reply within 24 hours</div>
            </div>
          </a>
        </div>

        {/* FAQs */}
        <p className="section-label" style={{ padding: '4px 0' }}>Frequently Asked Questions</p>
        {FAQS.map((faq, i) => (
          <div key={i} className="card" style={{ overflow: 'hidden' }}>
            <button style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', gap: 10 }}
              onClick={() => setOpen(open === i ? null : i)}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--gray-900)', flex: 1 }}>{faq.q}</span>
              <span style={{ fontSize: 12, color: 'var(--gray-400)', flexShrink: 0 }}>{open === i ? '▲' : '▼'}</span>
            </button>
            {open === i && (
              <div style={{ padding: '0 16px 14px', fontSize: 13, color: 'var(--gray-500)', lineHeight: 1.6, borderTop: '1px solid var(--gray-200)', paddingTop: 12 }}>
                {faq.a}
              </div>
            )}
          </div>
        ))}

        {/* Report */}
        <p className="section-label" style={{ padding: '4px 0' }}>Report an Issue</p>
        <div className="card" style={{ padding: 14 }}>
          <textarea style={{ width: '100%', border: '1.5px solid var(--gray-200)', borderRadius: 'var(--radius-sm)', padding: 12, fontFamily: 'inherit', fontSize: 13, resize: 'none', outline: 'none', color: 'var(--gray-900)' }}
            rows={4} placeholder="Describe your issue..." value={report} onChange={e => setReport(e.target.value)} />
          <button className="btn btn--primary btn--full" style={{ marginTop: 10 }}
            onClick={() => { if (!report.trim()) { alert('Please describe the issue'); return; } alert('Issue reported. We will respond within 24 hours.'); setReport(''); }}>
            Submit Report
          </button>
        </div>
      </div>
      <BottomNav />
    </div>
  );
}
