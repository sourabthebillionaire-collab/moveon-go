/**
 * Socket.io — Real-time layer
 * Connects to backend when VITE_SOCKET_URL is set in .env
 */

import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001';

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
    _socket.on('connect_error', ()  => { /* silent — backend not running yet */ });
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
export function emitRideResponse(rideId, action) {
  const s = getSocket();
  if (s.connected) s.emit('ride:respond', { rideId, action });
}

// ── Passenger: receive initial snapshot of ALL active vehicles ✅ NEW
export function onVehiclesSnapshot(cb) {
  const s = getSocket();
  s.on('vehicles:snapshot', cb);
  return () => s.off('vehicles:snapshot', cb);
}

// ── Passenger: receive single vehicle live update ─────────────
export function onVehiclesUpdate(cb) {
  const s = getSocket();
  s.on('vehicles:update', cb);
  return () => s.off('vehicles:update', cb);
}

// ── Passenger: handle driver going offline ✅ NEW ─────────────
export function onDriverOffline(cb) {
  const s = getSocket();
  s.on('driver:offline', cb);
  return () => s.off('driver:offline', cb);
}

// ── Passenger: track active booking ──────────────────────────
export function onBookingUpdate(cb) {
  const s = getSocket();
  s.on('booking:update', cb);
  return () => s.off('booking:update', cb);
}

// ── Join a room ───────────────────────────────────────────────
export function joinRoom(room) {
  const s = getSocket();
  if (s.connected) s.emit('join', room);
}
