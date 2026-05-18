// ─────────────────────────────────────────────────────────────────────────────
// RIDER SIDE — what to add to your rider booking page / hook
// This is the missing piece that makes the accept event actually show up.
// ─────────────────────────────────────────────────────────────────────────────

// ── In your rider booking page, after POST /api/bookings succeeds: ────────────

import { useEffect, useState, useRef } from 'react';
import { getSocket, connectSocket } from '../services/socket';

export function useBookingListener(bookingId) {
  const [bookingStatus, setBookingStatus] = useState('searching'); // 'searching' | 'accepted' | 'declined' | 'cancelled'
  const [driverInfo,    setDriverInfo]    = useState(null);        // { name, phone, vehicleNumber, rating, eta, driverId }
  const [driverLocation, setDriverLocation] = useState(null);      // { lat, lng, bearing, speed }
  const timeoutRef = useRef(null);

  useEffect(() => {
    if (!bookingId) return;

    const socket = connectSocket();

    // ✅ Step 1 — Join the booking room so backend can target this socket
    socket.emit('rider:joinBooking', { bookingId });

    // ✅ Step 2 — Listen for the driver's response
    const eventName = `booking:${bookingId}`;
    socket.on(eventName, ({ action, driver }) => {
      clearTimeout(timeoutRef.current);

      if (action === 'accept') {
        setBookingStatus('accepted');
        setDriverInfo(driver);          // { name, phone, vehicleNumber, vehicleType, rating, eta, driverId }
      } else if (action === 'decline') {
        setBookingStatus('declined');
        // Optionally re-search for another driver here
      } else if (action === 'cancelled') {
        setBookingStatus('cancelled');
      }
    });

    // ✅ Step 3 — Track accepted driver's live location
    socket.on('driver:locationUpdate', ({ driverId, lat, lng, bearing, speed }) => {
      // Only update if this is our driver
      if (driverInfo && String(driverId) === String(driverInfo.driverId)) {
        setDriverLocation({ lat, lng, bearing, speed });
      }
    });

    // ✅ Step 4 — 60s timeout if no driver accepts
    timeoutRef.current = setTimeout(() => {
      if (bookingStatus === 'searching') {
        setBookingStatus('timeout');
      }
    }, 60000);

    return () => {
      socket.off(eventName);
      socket.off('driver:locationUpdate');
      clearTimeout(timeoutRef.current);
    };
  }, [bookingId]);

  // When driverInfo arrives, also listen to vehicles:update as fallback
  // (for broad location broadcasts when not yet in activeBookings map)
  useEffect(() => {
    if (!driverInfo?.driverId) return;
    const socket = getSocket();
    if (!socket) return;

    const handleVehicleUpdate = (data) => {
      if (String(data.id) === String(driverInfo.driverId)) {
        setDriverLocation({ lat: data.lat, lng: data.lng, bearing: data.bearing, speed: data.speed });
      }
    };
    socket.on('vehicles:update', handleVehicleUpdate);
    return () => socket.off('vehicles:update', handleVehicleUpdate);
  }, [driverInfo?.driverId]);

  return { bookingStatus, driverInfo, driverLocation };
}

// ─────────────────────────────────────────────────────────────────────────────
// Example usage in your rider booking page:
// ─────────────────────────────────────────────────────────────────────────────

/*

function BookingWaiting({ bookingId }) {
  const { bookingStatus, driverInfo, driverLocation } = useBookingListener(bookingId);

  if (bookingStatus === 'searching') {
    return <SearchingSpinner />;
  }

  if (bookingStatus === 'accepted') {
    return (
      <div>
        <h2>Driver on the way!</h2>
        <p>{driverInfo.name} · {driverInfo.vehicleNumber}</p>
        <p>Rating: {driverInfo.rating} ★</p>
        <p>ETA: {driverInfo.eta}</p>
        <a href={`tel:${driverInfo.phone}`}>Call Driver</a>
        {driverLocation && (
          <LiveMap lat={driverLocation.lat} lng={driverLocation.lng} bearing={driverLocation.bearing} />
        )}
      </div>
    );
  }

  if (bookingStatus === 'timeout' || bookingStatus === 'declined') {
    return <div>No drivers available right now. Try again?</div>;
  }

  if (bookingStatus === 'cancelled') {
    return <div>Booking was cancelled.</div>;
  }
}

*/
