import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import Header from '../components/Header';
import BottomNav from '../components/BottomNav';
import { getCurrentPosition } from '../services/geocoding';
import { getRoute, fmtDist, fmtDuration } from '../services/routing';
import { onVehiclesUpdate, connectSocket } from '../services/socket';
import api from '../services/api';
import './MapView.css';

// Fix Leaflet default icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl:       'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl:     'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

function vehicleIcon(type) {
  const colors = { bus: '#1565C0', auto: '#E6A800', cab: '#1565C0', bike: '#6D28D9' };
  const labels = { bus: 'BUS', auto: 'AUTO', cab: 'CAB', bike: 'BIKE' };
  const bg = colors[type] || colors.bus;
  return L.divIcon({
    className: '',
    html: `<div style="background:${bg};color:#fff;font-size:10px;font-weight:700;padding:4px 8px;border-radius:6px;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,0.25);font-family:Inter,sans-serif;border:1.5px solid rgba(255,255,255,0.3)">${labels[type]||'VEH'}</div>`,
    iconAnchor: [22, 14], popupAnchor: [0, -16],
  });
}

function userIcon() {
  return L.divIcon({
    className: '',
    html: `<div style="width:14px;height:14px;background:#1565C0;border:2.5px solid #fff;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.3)"></div>`,
    iconAnchor: [7, 7],
  });
}

export default function MapView() {
  const mapRef      = useRef(null);
  const mapInst     = useRef(null);
  const markersRef  = useRef({});
  const routeRef    = useRef(null);
  const userMkrRef  = useRef(null);

  const [vehicles,    setVehicles]    = useState([]);
  const [selected,    setSelected]    = useState(null);
  const [userPos,     setUserPos]     = useState(null);
  const [routeInfo,   setRouteInfo]   = useState(null);
  const [loadRoute,   setLoadRoute]   = useState(false);
  const [filter,      setFilter]      = useState('all');
  const [loading,     setLoading]     = useState(true);
  const routeState = useLocation().state || {};

  // Init map
  useEffect(() => {
    if (mapInst.current) return;
    const map = L.map(mapRef.current, { center: [20.296, 85.824], zoom: 13, zoomControl: false });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors', maxZoom: 19,
    }).addTo(map);
    L.control.zoom({ position: 'topright' }).addTo(map);
    mapInst.current = map;
    return () => { if (mapInst.current) { mapInst.current.remove(); mapInst.current = null; } };
  }, []);

  // Get user GPS
  useEffect(() => {
    (async () => {
      try {
        const pos = await getCurrentPosition();
        setUserPos(pos);
        const map = mapInst.current;
        if (!map) return;
        if (userMkrRef.current) userMkrRef.current.setLatLng([pos.lat, pos.lng]);
        else {
          userMkrRef.current = L.marker([pos.lat, pos.lng], { icon: userIcon(), zIndexOffset: 1000 })
            .bindPopup('<b>You are here</b>').addTo(map);
        }
        map.setView([pos.lat, pos.lng], 14);
      } catch {}
    })();
  }, []);

  // Fetch nearby vehicles from backend
  useEffect(() => {
    if (!userPos) return;
    const fetchVehicles = async () => {
      setLoading(true);
      try {
        const data = await api.getNearbyVehicles(userPos.lat, userPos.lng, filter === 'all' ? 'all' : filter);
        setVehicles(data.vehicles || []);
        (data.vehicles || []).forEach(v => addOrUpdateMarker(v));
      } catch {
        // Backend not connected — show empty state, no demo data
        setVehicles([]);
      } finally {
        setLoading(false);
      }
    };
    fetchVehicles();
    const interval = setInterval(fetchVehicles, 10000);
    return () => clearInterval(interval);
  }, [userPos, filter]);

  // Real-time updates via socket
  useEffect(() => {
    connectSocket();
    const unsub = onVehiclesUpdate(data => {
      setVehicles(data);
      data.forEach(v => addOrUpdateMarker(v));
    });
    return unsub;
  }, []);

  function addOrUpdateMarker(v) {
    const map = mapInst.current;
    if (!map) return;
    const existing = markersRef.current[v.id];
    if (existing) {
      existing.setLatLng([v.lat, v.lng]);
    } else {
      const m = L.marker([v.lat, v.lng], { icon: vehicleIcon(v.type) })
        .addTo(map)
        .on('click', () => focusVehicle(v));
      m.bindPopup(buildPopup(v));
      markersRef.current[v.id] = m;
    }
  }

  function buildPopup(v) {
    return `<div style="font-family:Inter,sans-serif;font-size:12px;min-width:140px;line-height:1.5">
      <div style="font-weight:700;margin-bottom:4px">${v.vehicleNumber || v.number}</div>
      ${v.from && v.to ? `<div style="color:#6B7280">${v.from} → ${v.to}</div>` : ''}
      <div style="color:#6B7280">Speed: ${v.speed || 0} km/h</div>
      <div style="color:#6B7280">Status: ${v.status || 'Active'}</div>
    </div>`;
  }

  async function focusVehicle(v) {
    setSelected(v);
    setLoadRoute(true);
    setRouteInfo(null);
    const map = mapInst.current;
    if (map) map.flyTo([v.lat, v.lng], 15, { duration: 1 });

    const from = userPos || { lat: 20.296, lng: 85.824 };
    const route = await getRoute(from, { lat: v.lat, lng: v.lng });

    if (route && map) {
      if (routeRef.current) map.removeLayer(routeRef.current);
      routeRef.current = L.polyline(route.coordinates, {
        color: '#1565C0', weight: 4, opacity: 0.8,
        lineJoin: 'round', lineCap: 'round',
      }).addTo(map);
      map.fitBounds(L.latLngBounds([[from.lat, from.lng], [v.lat, v.lng]]).pad(0.2));
      setRouteInfo(route);
    }
    markersRef.current[v.id]?.openPopup();
    setLoadRoute(false);
  }

  const filtered = filter === 'all' ? vehicles : vehicles.filter(v => v.type === filter);

  return (
    <div className="app">
      <Header title="Live Map" />
      <div className="map-page">

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

        {/* Bottom panel */}
        <div className="map-panel">
          {/* Vehicle chips */}
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

          {/* Empty state */}
          {!loading && filtered.length === 0 && (
            <div className="map-empty">
              <div className="map-empty__dot" />
              <p>No {filter === 'all' ? 'vehicles' : filter+'s'} active near you right now</p>
            </div>
          )}

          {loading && (
            <div style={{display:'flex',alignItems:'center',gap:10,padding:'0 16px 10px',color:'var(--gray-400)',fontSize:13}}>
              <span className="spinner" style={{width:16,height:16,borderWidth:2}}/>
              Locating nearby vehicles...
            </div>
          )}

          {/* Selected vehicle detail */}
          {selected && (
            <div className="map-detail slide-up">
              <div className="map-detail__row">
                <div className="map-detail__badge">{selected.type?.toUpperCase()}</div>
                <div className="map-detail__info">
                  <div className="map-detail__num">{selected.vehicleNumber || selected.number}</div>
                  {selected.from && selected.to && (
                    <div className="map-detail__route">{selected.from} → {selected.to}</div>
                  )}
                  <div className="map-detail__status">
                    <span className="live-dot" style={{width:6,height:6}}/>
                    {selected.status || 'Active'} · {selected.speed || 0} km/h
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

              {selected.type === 'bus' && typeof selected.passengers === 'number' && (
                <div className="map-detail__occ">
                  <div className="map-detail__occ-bar">
                    <div className="map-detail__occ-fill"
                      style={{width:`${Math.min(100,Math.round((selected.passengers/selected.capacity||60)*100))}%`,
                      background: selected.passengers/selected.capacity > 0.8 ? 'var(--danger)' : 'var(--green-600)'}}/>
                  </div>
                  <span>{selected.passengers}/{selected.capacity} passengers</span>
                </div>
              )}

              <div className="map-detail__actions">
                <button className="btn btn--secondary" style={{flex:1}} onClick={() => focusVehicle(selected)}>
                  Show Route
                </button>
                {selected.type !== 'bus' && (
                  <button className="btn btn--primary" style={{flex:1}}
                    onClick={() => window.location.href=`/book?type=${selected.type}&vehicleId=${selected.id}`}>
                    Book Now
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      <BottomNav />
    </div>
  );
}
