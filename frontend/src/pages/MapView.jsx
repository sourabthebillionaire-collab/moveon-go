import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import Header from '../components/Header';
import BottomNav from '../components/BottomNav';
import { watchPosition } from '../services/geocoding';
import { getRoute, fmtDist, fmtDuration } from '../services/routing';
import { connectSocket, getSocket, onVehiclesSnapshot, onVehiclesUpdate, onDriverOffline } from '../services/socket';
import api from '../services/api';
import './MapView.css';

// Fix Leaflet default icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl:       'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl:     'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

function vehicleIcon(v) {
  const colors = { bus: '#1565C0', auto: '#E6A800', cab: '#1565C0', bike: '#6D28D9' };
  const type = v.type || 'bus';
  const bg = colors[type] || colors.bus;
  // FIX: Show route number on marker for buses, otherwise vehicle type
  const label = (type === 'bus' && v.routeNumber) ? v.routeNumber : type.toUpperCase();
  // Added: Rotation based on bearing for better spatial awareness
  const rotation = v.bearing || 0;

  return L.divIcon({
    className: 'vehicle-marker-glide',
    html: `<div class="marker-interpolated" style="transform: rotate(${rotation}deg); background:${bg};color:#fff;font-size:10px;font-weight:700;padding:4px 8px;border-radius:6px;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,0.25);font-family:Inter,sans-serif;border:1.5px solid rgba(255,255,255,0.3); transition: all 0.5s linear;">${label}</div>`,
    iconAnchor: [22, 14], popupAnchor: [0, -16],
  });
}

function userIcon() {
  return L.divIcon({
    className: 'user-marker-container',
    html: `
      <div class="user-marker-pulse"></div>
      <div class="user-marker-dot"></div>
    `,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });
}

export default function MapView() {
  const mapRef      = useRef(null);
  const mapInst     = useRef(null);
  const markersRef  = useRef({});
  const routeRef    = useRef(null);
  const timestampsRef = useRef({}); // FIX: Track data freshness per vehicle
  const userPosRef  = useRef(null); // FIX: Latest user location for socket callbacks
  const focusRef    = useRef(null); // FIX: Prevent race conditions in focusVehicle
  const userMkrRef  = useRef(null);

  const [vehicles,    setVehicles]    = useState([]);
  const [selected,    setSelected]    = useState(null);
  const [userPos,     setUserPos]     = useState(null);
  const [routeInfo,   setRouteInfo]   = useState(null);
  const [loadRoute,   setLoadRoute]   = useState(false);
  const [filter,      setFilter]      = useState('all');
  const [loading,     setLoading]     = useState(true);
  
  // ✅ Persistent state to keep data visible during the slide-down animation
  const [displayVehicle, setDisplayVehicle] = useState(null);
  useEffect(() => {
    if (selected) setDisplayVehicle(selected);
  }, [selected]);

  const routeState = useLocation().state || {};
  const navigate = useNavigate();

  const DEFAULT_CENTER = [20.296, 85.824]; // Move to config/env eventually

  // Init map
  useEffect(() => {
    if (mapInst.current) return;
    const map = L.map(mapRef.current, { center: DEFAULT_CENTER, zoom: 13, zoomControl: false });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors', maxZoom: 19,
    }).addTo(map);
    L.control.zoom({ position: 'topright' }).addTo(map);
    mapInst.current = map;
    return () => { if (mapInst.current) { mapInst.current.remove(); mapInst.current = null; } };
  }, []);

  // Get user GPS
  useEffect(() => {
    const unsub = watchPosition(pos => {
      setUserPos(pos);
      userPosRef.current = pos;
      const map = mapInst.current;
      if (!map) return;
      if (userMkrRef.current) {
        userMkrRef.current.setLatLng([pos.lat, pos.lng]);
      } else {
        userMkrRef.current = L.marker([pos.lat, pos.lng], { icon: userIcon(), zIndexOffset: 1000 })
          .bindPopup('<b>You are here</b>').addTo(map);
        map.setView([pos.lat, pos.lng], 14);
      }
    });
    return () => unsub();
  }, []);

  // Fetch nearby vehicles from backend (REST fallback)
  useEffect(() => {
    if (!userPos) return;
    const fetchVehicles = async () => {
      setLoading(true);
      try {
        const data = await api.getNearbyVehicles(userPos.lat, userPos.lng, filter === 'all' ? 'all' : filter);
        setVehicles(data.vehicles || []);
        (data.vehicles || []).forEach(v => addOrUpdateMarker(v));
      } catch {
        setVehicles([]);
      } finally {
        setLoading(false);
      }
    };
    fetchVehicles();
    const interval = setInterval(fetchVehicles, 10000);
    return () => clearInterval(interval);
  }, [userPos, filter]);

  // FIX: Markers were not properly re-appearing when switching filters back to 'all'
  useEffect(() => {
    if (!mapInst.current) return;
    
    Object.entries(markersRef.current).forEach(([id, marker]) => {
      const vehicle = vehicles.find(v => String(v.id) === id);
      if (filter !== 'all' && vehicle && vehicle.type !== filter) {
        mapInst.current.removeLayer(marker);
        delete markersRef.current[id];
      }
    });
    
    // Re-sync current visible vehicles
    vehicles.forEach(v => addOrUpdateMarker(v));
  }, [filter]);

  // ── Real-time socket updates ──────────────────────────────────
  useEffect(() => {
    const socket = connectSocket();

    // Tell server we're a rider — it will send back all active vehicles immediately
    const announce = () => {
      const pos = userPosRef.current;
      socket.emit('rider:connected', pos ? { lat: pos.lat, lng: pos.lng } : null);
    };

    if (socket.connected) announce();
    socket.on('connect', announce);

    // ✅ Snapshot — all active vehicles at the moment we connected
    const unsubSnapshot = onVehiclesSnapshot((vehicles) => {
      vehicles.forEach(v => addOrUpdateMarker(v));
      setVehicles(vehicles);
      setLoading(false);
    });

    // ✅ Single vehicle live update — backend emits one vehicle at a time
    const unsubUpdate = onVehiclesUpdate((vehicle) => {
      // FIX: Only draw if it matches current filter
      if (filter === 'all' || vehicle.type === filter) {
        addOrUpdateMarker(vehicle);
      }
      setVehicles(prev => {
        const vid = String(vehicle.id);
        const exists = prev.find(v => String(v.id) === vid);
        if (exists) return prev.map(v => v.id === vehicle.id ? { ...v, ...vehicle } : v);
        return [...prev, vehicle];
      });
    });

    // ✅ Remove marker when driver disconnects
    const unsubOffline = onDriverOffline(({ driverId }) => {
      const id = String(driverId);
      if (markersRef.current[id]) {
        if (mapInst.current) {
          mapInst.current.removeLayer(markersRef.current[id]);
        }
        delete markersRef.current[id];
        delete timestampsRef.current[id];
      }
      setVehicles(prev => prev.filter(v => String(v.id) !== id));
      
      // FIX: If selected vehicle goes offline, clear local state and polyline
      setSelected(s => {
        if (s && String(s.id) === id) {
          if (routeRef.current && mapInst.current) {
            mapInst.current.removeLayer(routeRef.current);
            routeRef.current = null;
          }
          setRouteInfo(null);
          return null;
        }
        return s;
      });
    });

    return () => {
      socket.off('connect', announce);
      unsubSnapshot();
      unsubUpdate();
      unsubOffline();
    };
  }, [filter]); // Re-bind so listener has access to latest filter state

  // FIX: Auto-focus vehicle from navigation state (e.g. when coming from Bus List)
  useEffect(() => {
    if (vehicles.length > 0 && routeState.busId) {
      const target = vehicles.find(v => String(v.id) === String(routeState.busId));
      if (target) {
        focusVehicle(target);
        // Clear navigation state so it doesn't keep re-focusing on every data update
        navigate(location.pathname, { replace: true, state: { ...routeState, busId: null } });
      }
    }
  }, [vehicles, routeState.busId]);

  function addOrUpdateMarker(v) {
    const map = mapInst.current;
    if (!map || !v.lat || !v.lng) return;
    const id = String(v.id);
    const existing = markersRef.current[id];
    
    // FIX: Freshness Check. Only update if data is newer than current marker
    const lastTs = timestampsRef.current[id] || 0;
    const newTs  = v.ts || lastTs + 1; // BUG 6: Avoid using Date.now() as fallback for ordering
    if (newTs < lastTs) return; 
    timestampsRef.current[id] = newTs;

    if (existing) {
      // Polished: Use direct setLatLng. The CSS transition 'marker-interpolated' 
      // in MapView.css will handle the visual glide.
      existing.setLatLng([v.lat, v.lng]);
      existing.setPopupContent(buildPopup(v));
      existing.setIcon(vehicleIcon(v)); // Ensure icon labels update
    } else {
      const m = L.marker([v.lat, v.lng], { icon: vehicleIcon(v) })
        .addTo(map)
        .on('click', () => focusVehicle(v));
      m.bindPopup(buildPopup(v));
      markersRef.current[id] = m;
    }
  }

  function buildPopup(v) {
    const isBus   = v.type === 'bus'; // FIX: Ensure v.number is not used as it's not consistently provided by API
    const title   = isBus && v.busName ? v.busName : (v.vehicleNumber || '');
    const route   = isBus && v.routeFrom && v.routeTo ? `${v.routeFrom} → ${v.routeTo}` : (v.from && v.to ? `${v.from} → ${v.to}` : '');
    const routeNo = isBus && v.routeNumber ? `Route ${v.routeNumber} · ` : '';

    return `<div style="font-family:Inter,sans-serif;font-size:12px;min-width:160px;line-height:1.6">
      <div style="font-weight:700;font-size:13px;margin-bottom:2px;color:#0D47A1">${title}</div>
      ${v.vehicleNumber ? `<div style="color:#94A3B8;font-size:11px;margin-bottom:4px">${v.vehicleNumber}</div>` : ''}
      ${route ? `<div style="color:#374151;font-size:12px;margin-bottom:2px">🛣 ${routeNo}${route}</div>` : ''}
      <div style="color:#6B7280">⚡ ${v.speed || 0} km/h &nbsp;·&nbsp; ${v.status || 'Active'}</div>
      <div style="margin-top:8px; border-top:1px solid #eee; padding-top:8px;">
        <a href="https://www.openstreetmap.org/?mlat=${v.lat}&mlon=${v.lng}#map=16/${v.lat}/${v.lng}" 
           target="_blank" 
           style="display:block; background:#0D47A1; color:white; text-align:center; padding:6px; border-radius:4px; text-decoration:none; font-weight:700; font-size:11px;">
           View on OSM ↗
        </a>
      </div>
    </div>`;
  }

  async function focusVehicle(v) {
    const vid = String(v.id);
    focusRef.current = vid;
    setSelected(v);
    setLoadRoute(true);
    setRouteInfo(null);
    const map = mapInst.current;
    if (map) map.flyTo([v.lat, v.lng], 15, { duration: 1 });

    if (!userPos) {
      setLoadRoute(false); // BUG 7: Fixed stuck spinner
      return;
    }

    const route = await getRoute(userPos, { lat: v.lat, lng: v.lng });

    // RACE CONDITION FIX: Only update UI if the user hasn't selected another vehicle during the await
    if (focusRef.current === vid && map) {
      if (route) {
        if (routeRef.current) map.removeLayer(routeRef.current);
        routeRef.current = L.polyline(route.coordinates, {
          color: '#1565C0', weight: 4, opacity: 0.8,
          lineJoin: 'round', lineCap: 'round',
        }).addTo(map);
        map.fitBounds(L.latLngBounds([[userPos.lat, userPos.lng], [v.lat, v.lng]]).pad(0.2));
        setRouteInfo(route);
      }
      // Ensure popup is opened only for the currently focused marker
      if (markersRef.current[vid]) markersRef.current[vid].openPopup(); // BUG 8: Guard marker ref
    }

    setLoadRoute(false);
  }

  const filtered = filter === 'all' ? vehicles : vehicles.filter(v => v.type === filter);

  return (
    <div className="app">
      <Header title="Live Map" />
      <div className="map-page" style={{ position: 'relative' }}>

        {/* Filter bar */}
        <div className="map-filters">
          {['all','bus','auto','cab','bike'].map(f => (
            <button key={f} className={`chip ${filter===f?'active':''}`} onClick={() => setFilter(f)}>
              {f === 'all' ? 'All' : f.charAt(0).toUpperCase()+f.slice(1)}
            </button>
          ))}
        </div>

        {/* Map */}
        <div ref={mapRef} className="map-canvas" />

        {/* ✅ Loading Overlay: Smooth transition when fading out */}
        <div style={{
          position: 'absolute',
          inset: 0,
          zIndex: 1001,
          background: 'rgba(255,255,255,0.8)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
          opacity: loading ? 1 : 0,
          visibility: loading ? 'visible' : 'hidden',
          pointerEvents: loading ? 'auto' : 'none',
          transition: 'opacity 0.5s ease, visibility 0.5s'
        }}>
          <span className="spinner" style={{ width: 32, height: 32, borderWidth: 3 }} />
          <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--gray-600)', margin: 0 }}>Fetching live vehicles...</p>
        </div>

        {/* Bottom panel */}
        <div className="map-panel">
          {filtered.length > 0 && (
            <div className="chips" style={{paddingBottom:10}}>
              {filtered.map(v => (
                <button key={v.id}
                  className={`chip ${selected?.id===v.id?'active':''}`}
                  onClick={() => focusVehicle(v)}>
                  {v.vehicleNumber || v.number}
                </button>
              ))}
            </div>
          )}

          {!loading && filtered.length === 0 && (
            <div className="map-empty">
              <div className="map-empty__dot" />
              <p>No {filter === 'all' ? 'vehicles' : filter+'s'} active near you right now</p>
            </div>
          )}

          {/* ✅ Detail Card: Now uses opacity and transform for a smooth slide-up effect */}
          <div 
            className="map-detail" 
            style={{
              display: displayVehicle ? 'block' : 'none',
              opacity: selected ? 1 : 0,
              transform: selected ? 'translateY(0)' : 'translateY(20px)',
              visibility: selected ? 'visible' : 'hidden',
              pointerEvents: selected ? 'auto' : 'none',
              transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
            }}
          >
            {displayVehicle && (
              <>
                <div className="map-detail__row">
                  <div className="map-detail__badge">{displayVehicle.type?.toUpperCase()}</div>
                  <div className="map-detail__info">
                    <div className="map-detail__num">{displayVehicle.vehicleNumber || displayVehicle.number}</div>
                    {displayVehicle.from && displayVehicle.to && (
                      <div className="map-detail__route">{displayVehicle.from} → {displayVehicle.to}</div>
                    )}
                    <div className="map-detail__status">
                      <span className="live-dot" style={{width:6,height:6}}/>
                      {displayVehicle.status || 'Active'} · {displayVehicle.speed || 0} km/h
                    </div>
                  </div>
                  {loadRoute ? (
                    <span className="spinner" style={{width:20,height:20}}/>
                  ) : routeInfo ? (
                    <div className="map-detail__eta">
                      <div className="map-detail__eta-val">{fmtDuration(routeInfo.duration)}</div>
                      <div className="map-detail__eta-dist">{fmtDist(routeInfo.distance)}</div>
                    </div>
                  ) : null}
                </div>

                {displayVehicle.type === 'bus' && typeof displayVehicle.passengers === 'number' && (
                  <div className="map-detail__occ">
                    <div className="map-detail__occ-bar">
                      <div className="map-detail__occ-fill"
                        style={{width:`${Math.min(100,Math.round((displayVehicle.passengers/displayVehicle.capacity||60)*100))}%`,
                        background: displayVehicle.passengers/displayVehicle.capacity > 0.8 ? 'var(--danger)' : 'var(--green-600)'}}/>
                    </div>
                    <span>{displayVehicle.passengers}/{displayVehicle.capacity} passengers</span>
                  </div>
                )}

                <div className="map-detail__actions">
                  <button className="btn btn--secondary" style={{flex:1}} onClick={() => focusVehicle(displayVehicle)}>
                    Show Route
                  </button>
                  {displayVehicle.type !== 'bus' && (
                    <button className="btn btn--primary" style={{flex:1}}
                      onClick={() => navigate(`/book?type=${displayVehicle.type}&vehicleId=${displayVehicle.id}`)}>
                      Book Now
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
      <BottomNav />
    </div>
  );
}
