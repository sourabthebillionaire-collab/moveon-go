import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import BottomNav from '../components/BottomNav';
import './Privacy.css';

const SECTIONS = [
  {
    title: '1. Information We Collect',
    content: `MoveOn Go collects the following information to provide our services:

• Location Data: Real-time GPS coordinates for tracking buses, autos, cabs and bikes. This data is transmitted securely and is only used for route calculation and live tracking.

• Account Information: Name, phone number, and email address for account creation and communication.

• Trip Data: Pickup/dropoff locations, timestamps, vehicle type, and fare information to maintain your trip history.

• Device Information: Device type and OS version for app optimization.`
  },
  {
    title: '2. How We Use Your Information',
    content: `• To provide real-time vehicle tracking and routing services.
• To match passengers with nearby drivers.
• To calculate accurate fare estimates using distance data.
• To improve service quality and resolve disputes.
• To send booking confirmations and trip updates.
• We do NOT sell your personal data to third parties.`
  },
  {
    title: '3. Location Data & GPS',
    content: `MoveOn Go uses your device GPS to:
• Show your current position on the map.
• Auto-detect your pickup location.
• Calculate accurate routes using OpenStreetMap.
• Share your location with matched drivers during a trip.

Driver GPS data is shared in real-time with passengers tracking their ride. GPS tracking stops automatically when a trip ends.`
  },
  {
    title: '4. Data Storage & Security',
    content: `• Trip history is stored locally on your device and on our secure servers.
• All data transmissions use HTTPS encryption.
• Driver GPS data is transmitted via encrypted WebSocket connections.
• We retain trip data for 12 months for dispute resolution.
• You can request deletion of your data by contacting support.`
  },
  {
    title: '5. Third Party Services',
    content: `MoveOn Go uses the following third-party services:
• OpenStreetMap — for map tiles and geocoding (no personal data shared)
• OSRM — for route calculation (only coordinates shared, no identity)
• Socket.io — for real-time location updates

These services operate under their own privacy policies.`
  },
  {
    title: '6. Your Rights',
    content: `You have the right to:
• Access all data we hold about you.
• Correct inaccurate personal information.
• Delete your account and associated data.
• Opt out of non-essential data collection.
• Export your trip history.

To exercise these rights, contact us at support@moveon.in`
  },
  {
    title: '7. Terms of Service',
    content: `By using MoveOn Go you agree to:
• Provide accurate information when creating your account.
• Use the app only for lawful purposes.
• Not share your account credentials with others.
• Pay agreed fares promptly.
• Treat drivers and other users with respect.
• Not abuse the SOS/emergency features.

Violation of these terms may result in account suspension.`
  },
  {
    title: '8. Contact Us',
    content: `For privacy concerns or data requests:
📧 Email: support@moveon.in
📞 Phone: +91 73280 60281
⏰ Support hours: Mon–Sat, 9AM–6PM IST

This Privacy Policy was last updated: April 2026`
  },
];

export default function Privacy() {
  const navigate = useNavigate();

  return (
    <div className="app-wrapper">
      <Header title="Privacy & Terms" showBack onBack={() => navigate(-1)} />
      <div className="page-content">
        <div className="priv-hero">
          <span className="priv-icon">🔒</span>
          <h2>Privacy Policy & Terms</h2>
          <p>MoveOn Go is committed to protecting your privacy and providing a safe, transparent service.</p>
          <span className="priv-date">Last updated: April 2026</span>
        </div>

        <div className="priv-body">
          {SECTIONS.map((s, i) => (
            <div key={i} className="priv-section card">
              <h3 className="priv-title">{s.title}</h3>
              <p className="priv-content">{s.content}</p>
            </div>
          ))}

          <div className="priv-footer">
            <p>Questions? Contact us at</p>
            <a href="tel:+917328060281" className="priv-phone">📞 +91 73280 60281</a>
            <a href="mailto:support@moveon.in" className="priv-email">📧 support@moveon.in</a>
          </div>
        </div>
      </div>
      <BottomNav />
    </div>
  );
}
