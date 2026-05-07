/**
 * Format lat/lng coordinates to a readable string
 * @param {number} lat
 * @param {number} lng
 * @param {number} precision
 * @returns {string}
 */
export function formatCoords(lat, lng, precision = 4) {
  return `${lat.toFixed(precision)}, ${lng.toFixed(precision)}`;
}

/**
 * Return a color based on bus status
 * @param {string} status
 * @returns {string} CSS color
 */
export function getStatusColor(status) {
  switch (status) {
    case "In Service":
      return "#00e676";
    case "Delayed":
      return "#ffab40";
    case "Off Duty":
      return "#546e7a";
    case "Emergency":
      return "#ff5252";
    default:
      return "#00d4ff";
  }
}

/**
 * Return human-readable time since a timestamp
 * @param {number} timestamp - ms since epoch
 * @returns {string}
 */
export function getTimeSince(timestamp) {
  const delta = Math.floor((Date.now() - timestamp) / 1000);
  if (delta < 5) return "just now";
  if (delta < 60) return `${delta}s ago`;
  if (delta < 3600) return `${Math.floor(delta / 60)}m ago`;
  return `${Math.floor(delta / 3600)}h ago`;
}

/**
 * Compute distance between two lat/lng points in km (Haversine)
 * @param {number} lat1
 * @param {number} lng1
 * @param {number} lat2
 * @param {number} lng2
 * @returns {number}
 */
export function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Clamp a number between min and max
 */
export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
