import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
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
  const colors = { bus: '#1565C0', auto: '#E6A800', cab: '#1565C0' };
  const type = v.type || 'bus';
  const isOffline = v.status === 'offline';
  const bg = isOffline ? '#64748B' : (colors[type] || colors.bus);
  const opacity = isOffline ? 0.7 : 1;
  // FIX: Show route number on marker for buses, otherwise vehicle type
  const label = (type === 'bus' && v.routeNumber) ? v.routeNumber : type.toUpperCase();
  // Added: Rotation based on bearing for better spatial awareness
  const rotation = v.bearing || 0;

  return L.divIcon({
    className: 'vehicle-marker-glide',
    html: `<div class="marker-interpolated" style="transform: rotate(${rotation}deg); background:${bg}; opacity: ${opacity}; color:#fff;font-size:10px;font-weight:700;padding:4px 8px;border-radius:6px;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,0.25);font-family:Inter,sans-serif;border:1.5px solid rgba(255,255,255,0.3); transition: all 0.5s linear;">${label}</div>`,
    iconAnchor: [22, 14], popupAnchor: [0, -16],
  });
}

function RecenterIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--blue-600)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12h3M22 12h-3M12 2v3M12 22v-3"/>
      <circle cx="12" cy="12" r="7"/>
      <circle cx="12" cy="12" r="2" fill="currentColor"/>
    </svg>
  );
}

function FollowMeIcon({ active }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill={active ? "white" : "none"} stroke={active ? "white" : "var(--blue-600)"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="3 11 22 2 13 21 11 13 3 11"/>
    </svg>
  );
}

function ShareMapIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--blue-600)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v13"/>
    </svg>
  );
}

function RadiusSearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
      <circle cx="11" cy="11" r="2" fill="currentColor" opacity="0.3"/>
    </svg>
  );
}

function AreaIcon({ active }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={active ? "white" : "var(--blue-600)"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" strokeDasharray="3 3"/>
      <circle cx="12" cy="12" r="2" fill="currentColor"/>
    </svg>
  );
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
  const followMeRef = useRef(false); // Ref for GPS callback to avoid stale closure
  const searchCircleRef = useRef(null);
  const showSearchAreaRef = useRef(true);
  const searchRadiusRef = useRef(20);
  const [searchParams] = useSearchParams();

  const [vehicles,    setVehicles]    = useState([]);
  const [selected,    setSelected]    = useState(null);
  const [userPos,     setUserPos]     = useState(null);
  const [routeInfo,   setRouteInfo]   = useState(null);
  const [loadRoute,   setLoadRoute]   = useState(false);
  const [filter,      setFilter]      = useState(searchParams.get('filter') || 'all');
  const [loading,     setLoading]     = useState(true);
  const [followMe,    setFollowMe]    = useState(false);
  const [showLocationTooltip, setShowLocationTooltip] = useState(false);
  const [showSearchButton, setShowSearchButton] = useState(false);
  const [searchRadius, setSearchRadius] = useState(Number(searchParams.get('radius')) || 20);
  const [showSearchArea, setShowSearchArea] = useState(() => localStorage.getItem('map_show_area') !== 'false');
  const [radiusExpanded, setRadiusExpanded] = useState(false);
  
  // ✅ Persistent state to keep data visible during the slide-down animation
  const [displayVehicle, setDisplayVehicle] = useState(null);
  useEffect(() => {
    if (selected) setDisplayVehicle(selected);
  }, [selected]);

  // ✅ Sync refs for effects and callbacks
  useEffect(() => { showSearchAreaRef.current = showSearchArea; }, [showSearchArea]);
  useEffect(() => { searchRadiusRef.current = searchRadius; }, [searchRadius]);

  // Requirement 6: Auto-dismiss location tooltip after 2.5 seconds
  useEffect(() => {
    if (showLocationTooltip) {
      const timer = setTimeout(() => setShowLocationTooltip(false), 2500);
      return () => clearTimeout(timer);
    }
  }, [showLocationTooltip]);


  const location = useLocation();
  const routeState = location.state || {};
  const navigate = useNavigate();

  const DEFAULT_CENTER = [
    Number(import.meta.env.VITE_MAP_CENTER_LAT) || 20.296,
    Number(import.meta.env.VITE_MAP_CENTER_LNG) || 85.824
  ];

  // Init map
  useEffect(() => {
    if (mapInst.current) return;
    const latParam = searchParams.get('lat');
    const lngParam = searchParams.get('lng');
    const zoomParam = searchParams.get('zoom');
    const initialCenter = (latParam && lngParam) ? [parseFloat(latParam), parseFloat(lngParam)] : DEFAULT_CENTER;
    const initialZoom = zoomParam ? parseInt(zoomParam, 10) : 13;

    const map = L.map(mapRef.current, { center: initialCenter, zoom: initialZoom, zoomControl: false });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors', maxZoom: 19,
    }).addTo(map);
    L.control.zoom({ position: 'topright' }).addTo(map);

    // ✅ Disable Follow Me if the user manually drags the map
    map.on('dragstart', () => {
      setFollowMe(false);
      followMeRef.current = false;
    });

    // Show 'Search in this area' button when panning away from user location
    map.on('moveend', () => {
      if (!userPosRef.current) return;
      const center = map.getCenter();
      const userLatLng = L.latLng(userPosRef.current.lat, userPosRef.current.lng);
      if (center.distanceTo(userLatLng) > 1500) {
        setShowSearchButton(true);
      } else {
        setShowSearchButton(false);
      }
    });

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
        if (searchCircleRef.current) {
          searchCircleRef.current.setLatLng([pos.lat, pos.lng]);
        }
      } else {
        userMkrRef.current = L.marker([pos.lat, pos.lng], { icon: userIcon(), zIndexOffset: 1000 })
          .bindPopup('<b>You are here</b>').addTo(map);

        // ✅ Add search radius visual if enabled
        if (showSearchAreaRef.current) {
          searchCircleRef.current = L.circle([pos.lat, pos.lng], {
            radius: searchRadiusRef.current * 1000, 
            color: '#1565C0',
            fillColor: '#1565C0',
            fillOpacity: 0.05,
            weight: 1.5,
            dashArray: '5, 10',
            interactive: false
          }).addTo(map);
        }

        map.setView([pos.lat, pos.lng], 14);
      }

      // ✅ Auto-center map if Follow Me mode is active
      if (followMeRef.current) {
        map.panTo([pos.lat, pos.lng]);
      }
    });
    return () => unsub();
  }, []);

  // ✅ Sync map circle and trigger pulse
  useEffect(() => {
    if (searchCircleRef.current) {
      searchCircleRef.current.setRadius(searchRadius * 1000);
    }

    // Trigger visual pulse animation to highlight the new search area
    const map = mapInst.current;
    const pos = userPosRef.current;
    if (map && pos) {
      const pulse = L.circle([pos.lat, pos.lng], {
        radius: 0,
        color: '#1565C0',
        fillColor: '#1565C0',
        fillOpacity: 0.3,
        weight: 2,
        interactive: false
      }).addTo(map);

      let start = null;
      const duration = 600; // Snappy animation duration
      const animate = (timestamp) => {
        if (!start) start = timestamp;
        const progress = (timestamp - start) / duration;
        if (progress < 1) {
          pulse.setRadius(searchRadius * 1000 * progress);
          pulse.setStyle({ opacity: 1 - progress, fillOpacity: (1 - progress) * 0.3 });
          requestAnimationFrame(animate);
        } else {
          pulse.remove();
        }
      };
      requestAnimationFrame(animate);
    }
  }, [searchRadius]);

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
      // Remove marker if not in current list (Radius/Snapshot changed) or filter mismatch
      if (!vehicle || (filter !== 'all' && vehicle.type !== filter)) {
        mapInst.current.removeLayer(marker);
        delete markersRef.current[id];
        delete timestampsRef.current[id];
      }
    });
    
    // Re-sync current visible vehicles
    vehicles.forEach(v => addOrUpdateMarker(v));
  }, [filter, vehicles]);

  // ── Real-time socket updates ──────────────────────────────────
  useEffect(() => {
    const socket = connectSocket();

    // Tell server we're a rider — it will send back all active vehicles immediately
    const announce = () => {
      const pos = userPosRef.current;
      socket.emit('rider:connected', pos ? { lat: pos.lat, lng: pos.lng, radius: searchRadius } : null);
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

    // ✅ Keep marker but grey it out when driver goes offline
    const unsubOffline = onDriverOffline(({ driverId }) => {
      const id = String(driverId);
      setVehicles(prev => {
        const exists = prev.find(v => String(v.id) === id);
        if (exists) {
          const updated = { ...exists, status: 'offline', speed: 0, ts: Date.now() };
          addOrUpdateMarker(updated);
          return prev.map(v => String(v.id) === id ? updated : v);
        }
        return prev;
      });
    });

    // Refresh fleet on radius or filter change
    announce();

    return () => {
      socket.off('connect', announce);
      unsubSnapshot();
      unsubUpdate();
      unsubOffline();
    };
  }, [filter, searchRadius]); // Re-bind so listener has access to latest filter and radius

  // FIX: Auto-focus vehicle from navigation state (e.g. when coming from Bus List)
  useEffect(() => {
    const busIdParam = searchParams.get('busId');
    const targetId = routeState.busId || busIdParam;
    if (vehicles.length > 0 && targetId) {
      const target = vehicles.find(v => String(v.id) === String(targetId));
      if (target) {
        focusVehicle(target);
        // Clear navigation state so it doesn't keep re-focusing on every data update
        navigate(location.pathname, { replace: true, state: { ...routeState, busId: null } });
      }
    }
  }, [vehicles, routeState.busId, searchParams]);

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

    let updateLabel = '';
    if (v.status === 'offline' && v.ts) {
      const diff = Math.floor((Date.now() - v.ts) / 60000);
      const timeStr = diff < 1 ? 'Just now' : `${diff}m ago`;
      updateLabel = `<div style="font-size:10px; color:#94A3B8; margin-top:2px">Last update: ${timeStr}</div>`;
    }

    return `<div style="font-family:Inter,sans-serif;font-size:12px;min-width:160px;line-height:1.6">
      <div style="font-weight:700;font-size:13px;margin-bottom:2px;color:#0D47A1">${title}</div>
      ${v.vehicleNumber ? `<div style="color:#94A3B8;font-size:11px;margin-bottom:4px">${v.vehicleNumber}</div>` : ''}
      ${route ? `<div style="color:#374151;font-size:12px;margin-bottom:2px">🛣 ${routeNo}${route}</div>` : ''}
      <div style="color:#6B7280">
        ⚡ ${v.speed || 0} km/h &nbsp;·&nbsp; ${v.status || 'Active'}
        ${updateLabel}
      </div>
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

  const handleSearchThisArea = () => {
    if (!mapInst.current) return;
    const center = mapInst.current.getCenter();
    const socket = getSocket();
    // Force update fleet around new center
    socket?.emit('rider:connected', { 
      lat: center.lat, 
      lng: center.lng, 
      radius: searchRadius 
    });
    setShowSearchButton(false);
    window.navigator?.vibrate?.(10);
  };

  const handleRecenter = () => {
    if (!userPos) {
      // Optional: replace with a custom toast if available
      console.warn("Recenter failed: Waiting for GPS signal...");
      return;
    }

    if (mapInst.current) {
      mapInst.current.flyTo([userPos.lat, userPos.lng], 16, {
        duration: 1.2,
        easeLinearity: 0.25
      });
      
      // Open popup after the flight animation finishes for better UX
      mapInst.current.once('moveend', () => {
        if (userMkrRef.current) userMkrRef.current.openPopup();
      });
      setShowLocationTooltip(true);
    }
  };

  const toggleFollowMe = () => {
    const next = !followMe;
    setFollowMe(next);
    followMeRef.current = next;
    if (next) handleRecenter();
    window.navigator?.vibrate?.(10);
  };

  const toggleSearchArea = () => {
    const next = !showSearchArea;
    setShowSearchArea(next);
    showSearchAreaRef.current = next;
    localStorage.setItem('map_show_area', String(next));
    
    const map = mapInst.current;
    const pos = userPosRef.current;

    if (!next && searchCircleRef.current) {
      searchCircleRef.current.remove();
      searchCircleRef.current = null;
    } else if (next && pos && map) {
      searchCircleRef.current = L.circle([pos.lat, pos.lng], {
        radius: searchRadius * 1000,
        color: '#1565C0',
        fillColor: '#1565C0',
        fillOpacity: 0.05,
        weight: 1.5,
        dashArray: '5, 10',
        interactive: false
      }).addTo(map);
    }
    window.navigator?.vibrate?.(10);
  };

  const handleShareMap = async () => {
    if (!mapInst.current) return;
    const map = mapInst.current;
    const center = map.getCenter();
    const zoom = map.getZoom();
    
    const url = new URL(window.location.origin + window.location.pathname);
    url.searchParams.set('lat', center.lat.toFixed(6));
    url.searchParams.set('lng', center.lng.toFixed(6));
    url.searchParams.set('zoom', zoom.toString());
    url.searchParams.set('filter', filter);
    url.searchParams.set('radius', searchRadius.toString());
    if (selected) url.searchParams.set('busId', String(selected.id));

    const shareData = {
      title: 'MoveOn Go Live Fleet',
      text: 'Track live buses, autos and cabs on MoveOn Go! 🚌🚕',
      url: url.toString()
    };

    if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
      try { await navigator.share(shareData); } catch {}
    } else {
      await navigator.clipboard.writeText(url.toString());
      alert('Deep link copied to clipboard! 🔗');
    }
    window.navigator?.vibrate?.(10);
  };

  const filtered = filter === 'all' ? vehicles : vehicles.filter(v => v.type === filter);

  return (
    <div className="app">
      <Header title="Live Map" />
      <div className="page map-page" style={{ position: 'relative' }}>

        {/* Filter bar */}
        <div className="map-filters" style={{
          position: 'absolute',
          top: '12px',
          left: '0',
          right: '0',
          zIndex: 1000,
          display: 'flex',
          justifyContent: 'center',
          pointerEvents: 'none'
        }}>
          <div style={{ display: 'flex', gap: '8px', pointerEvents: 'auto', background: 'rgba(255,255,255,0.9)', padding: '6px 12px', borderRadius: '30px', boxShadow: '0 4px 15px rgba(0,0,0,0.1)', backdropFilter: 'blur(8px)', border: '1px solid var(--gray-200)' }}>
            {['all','bus','auto','cab'].map(f => (
              <button key={f} className={`chip ${filter===f?'active':''}`} onClick={() => setFilter(f)} style={{ margin: 0 }}>
                {f === 'all' ? 'All' : f.charAt(0).toUpperCase()+f.slice(1)}
              </button>
            ))}
            {/* Radius Selector */}
            <div style={{ width: 1, background: 'var(--gray-200)', margin: '0 4px' }} />
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              padding: '0 4px',
              transition: 'all 0.3s ease'
            }}>
               <button 
                 onClick={() => setRadiusExpanded(!radiusExpanded)}
                 style={{ background: 'none', border: 'none', padding: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', color: radiusExpanded ? 'var(--blue-600)' : 'var(--gray-400)', transition: 'color 0.2s' }}
               >
                 <RadiusSearchIcon />
               </button>
               {radiusExpanded && (
                 <select 
                   value={searchRadius} 
                   onChange={e => setSearchRadius(Number(e.target.value))}
                   style={{ background: 'none', border: 'none', fontSize: '11px', fontWeight: 700, color: 'var(--blue-600)', outline: 'none', cursor: 'pointer', paddingLeft: '4px', animation: 'map-fade-in 0.3s ease forwards' }}
                 >
                   {[5, 10, 20, 50].map(r => <option key={r} value={r}>{r}km</option>)}
                 </select>
               )}
            </div>
          </div>
        </div>

        {/* 'Search in this area' floating button */}
        {showSearchButton && (
          <button className="map-search-here-btn" onClick={handleSearchThisArea}>
            <RadiusSearchIcon />
            <span>Search in this area</span>
          </button>
        )}

        {/* Map */}
        <div ref={mapRef} className="map-canvas" />
        
        {/* Requirement 7: Professional Empty State Card */}
        {!loading && filtered.length === 0 && (
          <div className="map-empty-overlay">
            <div className="map-empty-card">
              <div className="map-empty-icon">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="16" height="16" x="4" y="3" rx="2"/>
                  <path d="M4 11h16M8 15h.01M16 15h.01M6 19v2M18 19v2"/>
                </svg>
              </div>
              <h3>No vehicles active nearby</h3>
              <p>We're waiting for drivers to come online in your area. Please check back in a moment or expand your search radius.</p>
            </div>
          </div>
        )}

        {/* Requirement 6: Modern Tooltip (Auto-dismisses) */}
        {showLocationTooltip && (
          <div className="map-location-tooltip">
            <div className="tooltip-dot" />
            <span>You are here</span>
          </div>
        )}

        {/* Requirement 1 & 2: Floating Action Hub (Grouped) */}
        <div className="map-controls-group" style={{ 
          bottom: selected ? '280px' : '100px',
          transition: 'bottom 0.3s ease' 
        }}>
          {/* Focus Vehicle / Follow Me */}
          <button 
            onClick={toggleFollowMe}
            aria-label="Toggle Follow Me"
            className={`map-control-btn ${followMe ? 'primary' : ''} map-recenter-btn`}
          >
            <FollowMeIcon active={followMe} />
          </button>

          {/* Share Map */}
          <button 
            onClick={handleShareMap}
            className="map-control-btn"
            aria-label="Share Map View"
          >
            <ShareMapIcon />
            <span style={{fontSize: 9, fontWeight: 800, color: 'inherit', letterSpacing: '0.2px', textTransform: 'uppercase', marginTop: 2}}>Share</span>
          </button>

          {/* Search Area Toggle */}
          <button 
            onClick={toggleSearchArea}
            className={`map-control-btn ${showSearchArea ? 'primary' : ''}`}
            aria-label="Toggle Search Area"
          >
            <AreaIcon active={showSearchArea} />
          </button>

          {/* Re-center / My Location */}
          <button 
            onClick={handleRecenter}
            className="map-control-btn"
            aria-label="Recenter Map"
          >
            <RecenterIcon />
          </button>
        </div>

        {/* Bottom panel */}
        <div className="map-panel">
          {/* ✅ Integrated Loading Bar: Professional non-blocking indicator */}
          {loading && (
            <div style={{ 
              display: 'flex', alignItems: 'center', gap: 10, 
              padding: '12px 16px', background: 'var(--white)',
              borderBottom: '1px solid var(--gray-100)',
              animation: 'fadeIn 0.3s ease'
            }}>
              <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
              <span style={{ fontSize: 13, color: 'var(--gray-500)', fontWeight: 500 }}>Connecting to live fleet...</span>
            </div>
          )}

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
                      {displayVehicle.status === 'offline' && displayVehicle.ts && (
                        <span style={{ marginLeft: 6, opacity: 0.8, fontSize: '0.95em' }}>
                          · Last active: {Math.floor((Date.now() - displayVehicle.ts) / 60000) < 1 ? 'Just now' : `${Math.floor((Date.now() - displayVehicle.ts) / 60000)}m ago`}
                        </span>
                      )}
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
