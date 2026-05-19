/**
 * Simple E2E simulator for booking lifecycle using the debug emit endpoint.
 * Usage:
 *   1. Ensure backend is running (NODE_ENV=development so debug endpoint enabled).
 *   2. Install dependency: `npm install socket.io-client` in repo root.
 *   3. Run: `node backend/scripts/e2e-simulate.js`
 *
 * The script will connect as a rider socket, listen for booking events for
 * bookingId 'e2e-test-1' and then call the debug endpoint to emit accept->start->complete.
 */

const { io } = require('socket.io-client');
const http = require('http');

const SOCKET_URL = process.env.SOCKET_URL || 'http://localhost:3001';
const DEBUG_URL = process.env.DEBUG_URL || 'http://localhost:3001/api/debug/emit-booking';
const BOOKING_ID = 'e2e-test-1';

function postDebug(payload) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(payload);
    const url = new URL(DEBUG_URL);
    const opts = {
      hostname: url.hostname,
      port: url.port || 80,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
      },
    };
    const req = http.request(opts, (res) => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function run() {
  console.log('[e2e] Connecting rider socket to', SOCKET_URL);
  const socket = io(SOCKET_URL, { transports: ['websocket'], autoConnect: true });

  socket.on('connect', () => {
    console.log('[e2e] Rider socket connected', socket.id);
    // join booking room
    socket.emit('rider:joinBooking', { bookingId: BOOKING_ID });
  });

  const eventName = `booking:${BOOKING_ID}`;
  socket.on(eventName, (data) => {
    console.log('[e2e] Rider received', eventName, data);
  });

  // Wait a bit to ensure socket connected
  await new Promise(r => setTimeout(r, 1000));

  console.log('[e2e] Emitting accept via debug endpoint');
  await postDebug({ bookingId: BOOKING_ID, action: 'accept', driver: { name: 'E2E Driver', driverId: 'drv-e2e' } });
  await new Promise(r => setTimeout(r, 1000));

  console.log('[e2e] Emitting started via debug endpoint');
  await postDebug({ bookingId: BOOKING_ID, action: 'started', driverId: 'drv-e2e' });
  await new Promise(r => setTimeout(r, 1000));

  console.log('[e2e] Emitting completed via debug endpoint');
  await postDebug({ bookingId: BOOKING_ID, action: 'completed', driverId: 'drv-e2e', fareAmount: 120 });

  console.log('[e2e] Done. Closing socket in 2s');
  setTimeout(() => { socket.close(); process.exit(0); }, 2000);
}

run().catch(err => { console.error('[e2e] Error', err); process.exit(1); });
