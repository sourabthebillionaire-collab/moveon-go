/**
 * API Service — MoveOn Go
 * All backend communication lives here.
 * Set VITE_API_URL in .env to connect your backend.
 * Default: http://localhost:3001/api
 */

// FIX: Trim accidental whitespace from env var to prevent connection failures.
// PRODUCTION: Use relative path if no env var, facilitating 'Single-Horizon' deployments.
// IMPROVEMENT: Normalize BASE to remove trailing slash to prevent double-slashes in requests.
const BASE = (import.meta.env.VITE_API_URL?.trim() || 
             (import.meta.env.PROD ? '/api' : 'http://localhost:3001/api'))
             .replace(/\/$/, '');

const REQUEST_TIMEOUT = 10000; // 10 seconds

async function request(method, path, body = null, token = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    const res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      // IMPROVEMENT: Provide more context for non-JSON or generic server errors
      const message = data.message || data.error || `Request failed with status ${res.status}`;
      const err = new Error(message);
      err.status = res.status;
      err.data   = data;
      throw err;
    }
    return data;
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error(`Request timeout (${REQUEST_TIMEOUT}ms). Please check your connection.`);
    }
    throw error;
  }
}

const get    = (path, token)       => request('GET',    path, null, token);
const post   = (path, body, token) => request('POST',   path, body, token);
const put    = (path, body, token) => request('PUT',    path, body, token);
const del    = (path, token)       => request('DELETE', path, null, token);

export const api = {

  // ── User Auth ─────────────────────────────────────────────────
  login: (phone, name) =>
    post('/auth/login', { phone, name }),

  getProfile: (token) =>
    get('/auth/me', token),

  updateProfile: (data, token) =>
    put('/auth/me', data, token),

  // ── Driver Auth ───────────────────────────────────────────────
  validateVehicleId: (vehicleId) =>
    get(`/driver/validate/${vehicleId}`),

  driverLogin: (vehicleId, pin, fcmToken) =>
    post('/driver/login', { vehicleId, pin, fcmToken }),

  getDriverProfile: (token) =>
    get('/driver/me', token),

  driverRegister: (data) =>
    post('/driver/register', data),

  updateDriverLocation: (data, token) =>
    post('/driver/location', data, token),

  setDriverDuty: (onDuty, token) =>
    post('/driver/duty', { onDuty }, token),

  logDriverEvent: (data, token) =>
    post('/driver/event', data, token),

  respondToRide: (rideId, action, token) =>
    post(`/rides/${rideId}/respond`, { action }, token),

  // ── Vehicles / Buses ──────────────────────────────────────────
  getNearbyVehicles: (lat, lng, type = 'all') =>
    get(`/vehicles/nearby?lat=${lat}&lng=${lng}&type=${type}`),

  getBusRoute: (routeId) =>
    get(`/buses/route/${routeId}`),

  getBusRoutes: () =>
    get('/buses/routes'),

  getVehicle: (vehicleId) =>
    get(`/vehicles/${vehicleId}`),

  // ── Config ────────────────────────────────────────────────────
  getAppConfig: () =>
    get('/config'),

  // ── Bookings ──────────────────────────────────────────────────
  createBooking: (data, token) => {
    // SYNC: Ensure fareAmount is numeric to match the updated Booking schema.
    // This prevents validation errors if the UI state contains a string representation.
    const payload = { ...data, fareAmount: Number(data.fareAmount || 0) };
    return post('/bookings', payload, token);
  },

  getBookings: (token) =>
    get('/bookings', token),

  cancelBooking: (bookingId, token) =>
    del(`/bookings/${bookingId}`, token),

  getActiveBooking: (token) =>
    get('/bookings/active', token),

  // Public tracking endpoint (no token required)
  getPublicTrip: (bookingId) =>
    get(`/bookings/public/${bookingId}`),

  // FIX: Verify driver's stored ride is still live in DB.
  // Prevents "Failed to start the ride" from stale localStorage rides.
  getDriverActiveBooking: (token) =>
    get('/bookings/driver-active', token),

  // Driver ride lifecycle
  startRide: (bookingId, token) => // OTP check removed on backend, so no need to send it
    put(`/rides/${bookingId}/start`, null, token),
  completeRide: (bookingId, token) =>
    put(`/rides/${bookingId}/complete`, null, token),
  cancelRide: (bookingId, token) =>
    put(`/rides/${bookingId}/cancel`, null, token),
  riderBoarded: (bookingId, token) =>
    put(`/rides/${bookingId}/boarded`, null, token),
  submitRideFeedback: (rideId, data, token) =>
    post(`/rides/${rideId}/feedback`, data, token),

  // ── Fare ──────────────────────────────────────────────────────
  getFareEstimate: (from, to, vehicleType) =>
    post('/fare/estimate', { from, to, vehicleType }),

  // ── Admin ─────────────────────────────────────────────────────
  adminLogin: (password) =>
    post('/admin/login', { password }),

  getAdminStats: (token, type = 'all') =>
    get(`/admin/stats?type=${type}`, token),

  getAdminDrivers: (status = 'all', token, type = 'all', q = '') =>
    get(`/admin/drivers?status=${status}&type=${type}&q=${q}`, token),

  approveDriver: (driverId, token) =>
    put(`/admin/drivers/${driverId}/approve`, {}, token),

  rejectDriver: (driverId, reason, token) =>
    put(`/admin/drivers/${driverId}/reject`, { reason }, token),

  deleteDriver: (driverId, token) =>
    del(`/admin/drivers/${driverId}`, token),

  getAdminUsers: (token) =>
    get('/admin/users', token),

  getAdminBookings: (token) =>
    get('/admin/bookings', token),

};

export default api;
