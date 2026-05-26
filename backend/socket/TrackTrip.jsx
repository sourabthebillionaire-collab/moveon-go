import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import Header from '../components/Header';
import api from '../services/api';
import { connectSocket, onBookingUpdate, onDriverLocationUpdate } from '../services/socket';
import './TrackTrip.css';

export default function TrackTrip() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [trip, setLoadingTrip] = useState(null);
  const [driver, setDriver] = useState(null);
  const [driverLoc, setDriverLoc] = useState(null);
  const [error, setError] = useState(null);

  const mapRef = useRef(null);
  const mapInst = useRef(null);
  const driverMkrRef = useRef(null);
  const pickupMkrRef = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.getPublicTrip(id);
        setLoadingTrip(res.booking);
        setDriver(res.booking.driverId);
        initMap(res.booking);
        setupListeners();
      } catch (err) {
        setError(err.message || 'Trip not found');
      } finally {
        setLoading(false);
      }
    })();

    return () => {
      if (mapInst.current) mapInst.current.remove();
    };
  }, [id]);

  const initMap = (b) => {
    if (mapInst.current) return;
    const map = L.map(mapRef.current, { zoomControl: false }).setView([b.pickupLat, b.pickupLng], 15);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
    
    pickupMkrRef.current = L.marker([b.pickupLat, b.pickupLng])
      .bindPopup('Pickup Point')
      .addTo(map);

    mapInst.current = map;
  };

  const setupListeners = () => {
    const socket = connectSocket();
    
    // Join as public viewer
    socket.emit('viewer:joinBooking', { bookingId: id });

    const unsubUpdate = onBookingUpdate(id, (data) => {
      if (data.action === 'completed' || data.action === 'cancelled') {
        alert(`Trip has ${data.action}`);
        navigate('/');
      }
      if (data.driver) setDriver(data.driver);
      if (data.location) updateDriverMarker(data.location);
    });

    const unsubLoc = onDriverLocationUpdate((data) => {
      updateDriverMarker(data);
    });

    return () => {
      unsubUpdate();
      unsubLoc();
    };
  };

  const updateDriverMarker = (loc) => {
    setDriverLoc(loc);
    if (!mapInst.current) return;
    if (driverMkrRef.current) {
      driverMkrRef.current.setLatLng([loc.lat, loc.lng]);
    } else {
      const icon = L.divIcon({
        className: 'driver-marker-public',
        html: `<div style="background:#0D47A1; color:white; padding:4px 8px; border-radius:4px; font-weight:bold; font-size:10px;">DRIVER</div>`,
        iconAnchor: [20, 10]
      });
      driverMkrRef.current = L.marker([loc.lat, loc.lng], { icon }).addTo(mapInst.current);
    }
  };

  if (loading) return <div className="track-loading">Locating trip...</div>;
  if (error) return <div className="track-error">{error}</div>;

  return (
    <div className="app">
      <Header title="Live Trip Tracking" />
      <div className="track-page" style={{ height: '100dvh', display: 'flex', flexDirection: 'column' }}>
        <div ref={mapRef} style={{ flex: 1 }} />
        
        {trip && (
          <div className="track-card card" style={{ margin: '16px', padding: '16px', position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 1000, background: 'white' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <div className="avatar" style={{ width: 44, height: 44, background: '#eee', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                {driver?.name?.[0] || 'D'}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 'bold', fontSize: 15 }}>{driver?.name || 'Searching...'}</div>
                <div style={{ fontSize: 12, color: '#666' }}>{driver?.vehicleNumber} · {trip.vehicleType.toUpperCase()}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: 'bold', color: 'var(--green-600)' }}>{trip.status.toUpperCase()}</div>
                <div style={{ fontSize: 11, color: '#999' }}>{trip.distance} · {trip.duration}</div>
              </div>
            </div>
            
            <div className="divider" style={{ margin: '12px 0' }} />
            
            <div style={{ fontSize: 13 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ color: 'var(--green-600)' }}>●</span> {trip.pickup}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: 'var(--danger)' }}>●</span> {trip.dropoff}
              </div>
            </div>
            
            <button 
              className="btn btn--primary btn--full" 
              style={{ marginTop: 16 }}
              onClick={() => navigate('/')}
            >
              Open MoveOn Go
            </button>
          </div>
        )}
      </div>
    </div>
  );
}