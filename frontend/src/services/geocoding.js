/**
 * Geocoding — OpenStreetMap Nominatim
 * PRODUCTION NOTE: At 5k users/day, you MUST replace this with 
 * Google Maps or Mapbox. Nominatim will rate-limit you.
 */

const BASE = 'https://nominatim.openstreetmap.org';
const HEADERS = { 'Accept-Language': 'en', 'User-Agent': 'MoveOnGo/1.0' };

export async function searchPlaces(query, limit = 6) {
  if (!query || query.trim().length < 2) return [];
  
  // Scalability Fix: Ensure we don't spam the service
  await new Promise(r => setTimeout(r, 200)); 

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const p = new URLSearchParams({ q: query, format: 'json', limit: String(limit), addressdetails: '1', countrycodes: 'in' });
    const res = await fetch(`${BASE}/search?${p}`, { headers: HEADERS, signal: controller.signal });
    const data = await res.json();
    clearTimeout(timeoutId);

    return data.map(d => ({
      id:       d.place_id,
      name:     shortName(d),
      fullName: d.display_name,
      lat:      parseFloat(d.lat),
      lng:      parseFloat(d.lon),
      type:     d.type,
    }));
  } catch { return []; }
}

export async function reverseGeocode(lat, lng) {
  try {
    const p = new URLSearchParams({ lat, lon: lng, format: 'json', zoom: '16' });
    const res = await fetch(`${BASE}/reverse?${p}`, { headers: HEADERS });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    
    const d = await res.json();
    if (d.error) throw new Error(d.error);
    
    const a = d.address || {};
    return [a.road || a.pedestrian, a.suburb || a.neighbourhood, a.city || a.town || a.village]
      .filter(Boolean).slice(0, 2).join(', ') || 'Current Location';
  } catch (e) { console.warn('[Geocoding] Reverse failed:', e.message); return 'Current Location'; }
}

function shortName(d) {
  const a = d.address || {};
  return [d.name || a.road, a.suburb || a.neighbourhood, a.city || a.town || a.village]
    .filter(Boolean).slice(0, 2).join(', ');
}

export function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) { reject(new Error('GPS not supported')); return; }
    navigator.geolocation.getCurrentPosition(
      p => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      e => reject(e),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
    );
  });
}

export function watchPosition(cb, errCb) {
  if (!navigator.geolocation) {
    if (errCb) errCb(new Error('GPS not supported'));
    return () => {};
  }
  const id = navigator.geolocation.watchPosition(
    p => cb({ lat: p.coords.latitude, lng: p.coords.longitude, speed: p.coords.speed || 0, bearing: p.coords.heading || 0 }),
    e => {
      console.warn('GPS error:', e.message);
      if (errCb) errCb(e);
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
  );
  return () => navigator.geolocation.clearWatch(id);
}
