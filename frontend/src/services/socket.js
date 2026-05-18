/**
 * Socket.io — Real-time layer
 * Connects to backend when VITE_SOCKET_URL is set in .env
 */
import { io } from 'socket.io-client';

const SOCKET_URL = (() => {
  const envUrl = import.meta.env.VITE_SOCKET_URL;
  if (envUrl) return envUrl;
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    return 'http://localhost:3001';
  }
  return window.location.origin;
})();

console.log('[Socket] Connecting to:', SOCKET_URL);

let _socket = null;

export function getSocket() {
  if (!_socket) {
    _socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
      timeout: 8000,
      autoConnect: false,
    });
    _socket.on('connect',       () => console.log('[Socket] Connected'));
    _socket.on('disconnect',    (r) => console.log('[Socket] Disconnected:', r));
    _socket.on('connect_error', ()  => { /* silent */ });
  }
  return _socket;
}

export function connectSocket() {
  const s = getSocket();
  if (!s.connected) s.connect();
  return s;
}

export function disconnectSocket() {
  if (_socket?.connected) _socket.disconnect();
}

// ── Driver: emit GPS location ─────────────────────────────────
export function emitLocation(payload) {
  const s = getSocket();
  if (s.connected) s.emit('driver:location', { ...payload, ts: Date.now() });
}

// ── Driver: listen for ride requests ─────────────────────────
export function onRideRequest(cb) {
  const s = getSocket();
  s.on('ride:request', cb);
  return () => s.off('ride:request', cb);
}

// ── Driver: respond to ride ───────────────────────────────────
// NOTE: kept for backwards compat but Driver.jsx no longer calls this.
// The HTTP route handles the socket emit with full driver details.
export function emitRideResponse(rideId, action) {
  const s = getSocket();
  if (s.connected) s.emit('ride:respond', { rideId, action });
}

// ── Rider: join booking room ──────────────────────────────────
// ✅ FIXED — was emitting 'join' which backend doesn't handle.
// Backend expects 'rider:joinBooking' to add socket to booking:{id} room.
export function joinBookingRoom(bookingId) {
  const s = getSocket();
  const doJoin = () => s.emit('rider:joinBooking', { bookingId });
  if (s.connected) {
    doJoin();
  } else {
    // If not connected yet, join as soon as we are
    s.once('connect', doJoin);
  }
}

// ── Rider: send current location while waiting for pickup ─────
export function emitRiderLocation(payload) {
  const s = getSocket();
  if (s.connected) s.emit('rider:location', { ...payload, ts: Date.now() });
}

// ── Rider: listen for booking status updates ──────────────────
// ✅ FIXED — was listening to 'booking:update' (wrong event name).
// Backend emits 'booking:{bookingId}' as a dynamic per-booking event.
// Callback receives: { action: 'accept'|'decline'|'cancelled', driver?: {...} }
export function onBookingResponse(bookingId, cb) {
  const s = getSocket();
  const eventName = `booking:${bookingId}`;
  s.on(eventName, cb);
  return () => s.off(eventName, cb);
}

// ── Rider: live location of accepted driver ───────────────────
// After accept, backend pushes 'driver:locationUpdate' to the booking room
export function onDriverLocationUpdate(cb) {
  const s = getSocket();
  s.on('driver:locationUpdate', cb);
  return () => s.off('driver:locationUpdate', cb);
}

// ── Rider: receive initial snapshot of ALL active vehicles ────
export function onVehiclesSnapshot(cb) {
  const s = getSocket();
  s.on('vehicles:snapshot', cb);
  return () => s.off('vehicles:snapshot', cb);
}

// ── Rider: receive single vehicle live update ─────────────────
export function onVehiclesUpdate(cb) {
  const s = getSocket();
  s.on('vehicles:update', cb);
  return () => s.off('vehicles:update', cb);
}

// ── Rider: handle driver going offline ───────────────────────
export function onDriverOffline(cb) {
  const s = getSocket();
  s.on('driver:offline', cb);
  return () => s.off('driver:offline', cb);
}

// ── Rider: announce presence (triggers vehicle snapshot) ──────
export function announceRider() {
  const s = getSocket();
  if (s.connected) s.emit('rider:connected');
}