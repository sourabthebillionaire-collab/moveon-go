import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import BottomNav from '../components/BottomNav';
import './Support.css';

const FAQS = [
  { q: 'How do I book an auto or cab?', a: 'Go to Home → tap Auto or Cab → enter pickup & drop → tap Book. A driver will be assigned within minutes.' },
  { q: 'How does live bus tracking work?', a: 'Buses with GPS-enabled devices share their location in real-time. Open Live Map to see all active buses near you.' },
  { q: 'Can I cancel a booking?', a: 'Yes. Go to your active booking and tap Cancel. Cancellations within 2 minutes are free.' },
  { q: 'How is the fare calculated?', a: 'Fare = Base charge + Per km rate × Distance. Auto: ₹25 base + ₹14/km. Cab: ₹60 base + ₹16/km. Bike: ₹20 + ₹8/km.' },
  { q: 'My GPS is not working. What to do?', a: 'Allow Location permission for MoveOn Go in phone Settings → Apps → MoveOn Go → Permissions → Location → Allow all the time.' },
  { q: 'How do I become a driver?', a: 'Go to Driver Panel → fill in vehicle details → toggle On Duty. Your GPS location will be shared with nearby passengers.' },
  { q: 'Is my location data safe?', a: 'Yes. All location data is encrypted and only shared during active trips. We never sell your data. See our Privacy Policy.' },
  { q: 'The map is not loading?', a: 'Check your internet connection. The map uses OpenStreetMap which requires internet. Try refreshing the page.' },
];

export default function Support() {
  const navigate = useNavigate();
  const [openFaq, setOpenFaq] = useState(null);
  const [report, setReport] = useState('');

  return (
    <div className="app-wrapper">
      <Header title="Help & Support" showBack onBack={() => navigate(-1)} />
      <div className="page-content">
        <div className="sup-hero">
          <span className="sup-icon">🆘</span>
          <h2>How can we help?</h2>
          <p>We are here for you 24/7</p>
        </div>

        <div className="sup-body">
          <p className="section-title">Contact Us</p>
          <div className="sup-contacts">
            <a href="tel:+917328060281" className="sup-contact-card phone">
              <span className="scc-icon">📞</span>
              <div>
                <div className="scc-label">Call Support</div>
                <div className="scc-val">+91 73280 60281</div>
                <div className="scc-sub">Mon–Sat · 9AM–6PM</div>
              </div>
            </a>
            <a href="https://wa.me/917328060281" target="_blank" rel="noreferrer" className="sup-contact-card whatsapp">
              <span className="scc-icon">💬</span>
              <div>
                <div className="scc-label">WhatsApp Us</div>
                <div className="scc-val">+91 73280 60281</div>
                <div className="scc-sub">Usually replies in 30 min</div>
              </div>
            </a>
            <a href="mailto:support@moveon.in" className="sup-contact-card email">
              <span className="scc-icon">📧</span>
              <div>
                <div className="scc-label">Email Support</div>
                <div className="scc-val">support@moveon.in</div>
                <div className="scc-sub">Reply within 24 hours</div>
              </div>
            </a>
          </div>

          <p className="section-title" style={{ marginTop: 20 }}>Frequently Asked Questions</p>
          <div className="sup-faqs">
            {FAQS.map((faq, i) => (
              <div key={i} className="faq-item card" onClick={() => setOpenFaq(openFaq === i ? null : i)}>
                <div className="faq-q">
                  <span>{faq.q}</span>
                  <span className="faq-arrow">{openFaq === i ? '▲' : '▼'}</span>
                </div>
                {openFaq === i && <div className="faq-a">{faq.a}</div>}
              </div>
            ))}
          </div>

          <p className="section-title" style={{ marginTop: 20 }}>Report an Issue</p>
          <div className="card sup-report">
            <textarea
              className="sup-textarea"
              placeholder="Describe your issue in detail..."
              rows={4}
              value={report}
              onChange={e => setReport(e.target.value)}
            />
            <button className="btn btn-primary" style={{ width: '100%', marginTop: 12 }}
              onClick={() => {
                if (!report.trim()) { alert('Please describe the issue first'); return; }
                alert('Issue reported! We will get back to you within 24 hours.\n\nOr call: +91 73280 60281');
                setReport('');
              }}>
              📤 Submit Report
            </button>
          </div>
        </div>
      </div>
      <BottomNav />
    </div>
  );
}
