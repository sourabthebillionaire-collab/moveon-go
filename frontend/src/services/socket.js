/**
 * Socket.io — Real-time layer
 * Connects to backend when VITE_SOCKET_URL is set in .env
 */
import { io } from 'socket.io-client';

// ── BUG #1 FIX: Trim env var to remove accidental whitespace ───
// If VITE_SOCKET_URL has a trailing space or newline in .env, the
// WebSocket tries to connect to the wrong URL and fails silently.
const SOCKET_URL = (() => {
  const envUrl = import.meta.env.VITE_SOCKET_URL?.trim();
  if (envUrl) return envUrl;
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    // Default to backend port in development
    return 'http://localhost:3001';
  }
  // Fallback to the current origin for production (Vercel/Heroku unified domain)
  if (import.meta.env.PROD) {
    console.warn('[Socket] VITE_SOCKET_URL not found. Falling back to window origin. ' +
                 'Note: WebSockets will fail if hosted on Vercel without a dedicated backend URL.');
  }
  return window.location.origin;
})();

console.log('[Socket] Connecting to:', SOCKET_URL);

let _socket = null;

export function getSocket() {
  if (!_socket) {
    _socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
      timeout: 8000,
      autoConnect: false,
    });
    _socket.on('connect',       () => console.log('[Socket] Connected:', _socket.id));
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
// BUG FIX: Previously attached listener without checking connection.
// If socket wasn't connected yet, the first ride:request after connect
// was missed. Now: defer attach until connected, and re-attach on
// every reconnect so the driver never misses requests.
export function onRideRequest(cb) {
  const s = getSocket();

  const attach = () => {
    s.off('ride:request', cb); // prevent duplicate listener on reconnect
    s.on('ride:request', cb);
  };

  if (s.connected) attach();
  
  // Re-attach on every future reconnect
  s.on('connect', attach);

  return () => {
    s.off('ride:request', cb);
    s.off('connect', attach);
  };
}

// ── Driver: respond to ride ───────────────────────────────────
// HTTP route handles the socket emit — this is kept for compat only.
export function emitRideResponse(rideId, action) {
  const s = getSocket();
  if (s.connected) s.emit('ride:respond', { rideId, action });
}

// ── Rider: join booking room ──────────────────────────────────
// BUG FIX: Previously joined once and stopped. If the socket dropped
// and reconnected, the rider left the booking:${id} room and missed
// all targeted events. Now re-joins on every reconnect.
// Returns a cleanup function to stop auto-rejoining when booking ends.
export function joinBookingRoom(bookingId) {
  const s = getSocket();

  const doJoin = () => {
    s.emit('rider:joinBooking', { bookingId });
    console.log('[Socket] Joining booking room:', bookingId);
  };

  if (s.connected) doJoin();
  
  s.on('connect', doJoin);

  return () => s.off('connect', doJoin);
}

// ── Rider: send current location while waiting for pickup ─────
export function emitRiderLocation(payload) {
  const s = getSocket();
  if (s.connected) s.emit('rider:location', { ...payload, ts: Date.now() });
}

// ── Rider: listen for booking status updates ──────────────────
// Backend emits 'booking:{bookingId}' as a dynamic per-booking event.
// Callback: { action: 'accept'|'decline'|'started'|'completed'|'cancelled'|'driver_offline', driver?: {...} }
export function onBookingResponse(bookingId, cb) {
  const s = getSocket();
  const eventName = `booking:${bookingId}`;
  const handler = (data) => {
    try { console.debug('[Socket] booking event', eventName, data); } catch (e) {}
    cb(data);
  };
  s.on(eventName, handler);
  return () => s.off(eventName, handler);
}

// ── Rider: live location of accepted driver ───────────────────
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
