/**
 * Routing — OSRM (Open Source Routing Machine)
 * Real road path calculation. No API key required.
 */

const OSRM = 'https://router.project-osrm.org/route/v1';

export async function getRoute(from, to, mode = 'driving') {
  try {
    const url = `${OSRM}/${mode}/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson&steps=false`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Routing service unavailable');
    const data = await res.json();
    if (data.code !== 'Ok' || !data.routes?.[0]) return null;
    const r = data.routes[0];
    return {
      coordinates: r.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
      distance:    r.distance,
      duration:    r.duration,
      distanceKm:  (r.distance / 1000).toFixed(1),
      durationMin: Math.ceil(r.duration / 60),
    };
  } catch (e) { console.warn('[Routing] Failed to fetch route:', e.message); return null; }
}

export function calcFare(distanceKm, type) {
  const km = parseFloat(distanceKm) || 0;
  const rates = {
    auto: { base: 25, per: 14 },
    cab:  { base: 60, per: 16 },
    bike: { base: 20, per:  8 },
  };
  const r = rates[type] || rates.auto;
  const amt = Math.round(r.base + km * r.per);
  return { min: Math.round(amt * 0.9), max: Math.round(amt * 1.1), avg: amt };
}

export function fmtDist(m) {
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`;
}

export function fmtDuration(sec) {
  const m = Math.ceil(sec / 60);
  return m < 60 ? `${m} min` : `${Math.floor(m/60)}h ${m%60}m`;
}
