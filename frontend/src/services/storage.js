/**
 * Local storage service — trip history, favourites, user session.
 * All data syncs to backend when connected.
 */

const K = {
  USER:       'mg_user',
  TOKEN:      'mg_token',
  DRIVER:     'mg_driver',
  DTOKEN:     'mg_driver_token',
  TRIPS:      'mg_trips',
  FAVOURITES: 'mg_favourites',
  ACTIVE_BOOKING: 'mg_active_booking',
  ACTIVE_DRIVER_RIDE: 'mg_active_driver_ride',
};

function read(key) {
  const val = localStorage.getItem(key);
  if (!val) return null;
  try { return JSON.parse(val); } catch (e) { console.error(`Storage parse error for ${key}:`, e); return null; }
}
function write(key, val)  { localStorage.setItem(key, JSON.stringify(val)); }
function remove(key)      { localStorage.removeItem(key); }

// ── User session ──────────────────────────────────────────────
export function getUser()          { return read(K.USER); }
export function getToken()         { return localStorage.getItem(K.TOKEN); }
export function setSession(u, tok) { write(K.USER, u); localStorage.setItem(K.TOKEN, tok); }
export function clearSession()     { remove(K.USER); remove(K.TOKEN); }

// ── Driver session ────────────────────────────────────────────
export function getDriver()              { return read(K.DRIVER); }
export function getDriverToken()         { return localStorage.getItem(K.DTOKEN); }
export function setDriverSession(d, tok) { write(K.DRIVER, d); localStorage.setItem(K.DTOKEN, tok); }
export function clearDriverSession()     { remove(K.DRIVER); remove(K.DTOKEN); }

// ── Trip history (aka Booking) ────────────────────────────────
export function getTrips() { return read(K.TRIPS) || []; }

export function addTrip(trip) {
  const trips = getTrips();
  trips.unshift({
    id: `${Date.now()}`,
    ts: Date.now(),
    ...trip
  });
  write(K.TRIPS, trips.slice(0, 50));
}

// ✅ Alias for your existing code
export const addBooking = addTrip;

export function clearTrips() { remove(K.TRIPS); }

// ── Favourites ────────────────────────────────────────────────
export function getFavourites() { return read(K.FAVOURITES) || []; }

export function addFavourite(place) {
  const favs = getFavourites().filter(f => f.id !== place.id);
  favs.unshift({
    ...place,
    savedAt: Date.now()
  });
  write(K.FAVOURITES, favs);
}

export function removeFavourite(id) {
  write(K.FAVOURITES, getFavourites().filter(f => f.id !== id));
}

// ── Active Booking ────────────────────────────────────────────
// Track the current active booking so we can restore state on page reload
export function getActiveBooking() {
  return read(K.ACTIVE_BOOKING);
}

export function setActiveBooking(booking) {
  write(K.ACTIVE_BOOKING, booking);
}

export function clearActiveBooking() {
  remove(K.ACTIVE_BOOKING);
}

// ── Active Driver Ride ────────────────────────────────────────
export function getActiveDriverRide() {
  return read(K.ACTIVE_DRIVER_RIDE);
}

export function setActiveDriverRide(ride) {
  write(K.ACTIVE_DRIVER_RIDE, ride);
}

export function clearActiveDriverRide() {
  remove(K.ACTIVE_DRIVER_RIDE);
}
