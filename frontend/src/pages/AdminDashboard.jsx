import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import api from '../services/api';
import { connectSocket } from '../services/socket';
import './AdminDashboard.css';

/**
 * Admin Dashboard
 * Displays platform statistics and high-priority alerts (SOS).
 */
export default function AdminDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [sosDrivers, setSosDrivers] = useState([]);
  const [vehicleFilter, setVehicleFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    const token = localStorage.getItem('admin_token');
    if (!token) {
      navigate('/admin/login');
      return;
    }
    try {
      const data = await api.getAdminStats(token, vehicleFilter);
      setStats(data);
      if (data.sosAlerts > 0) {
        const res = await api.getAdminDrivers('sos', token, vehicleFilter);
        setSosDrivers(res.drivers || []);
      } else {
        setSosDrivers([]);
      }
      setError(null);
    } catch (err) {
      setError('Failed to fetch dashboard statistics. Please try again.');
      if (err.status === 401 || err.status === 403) navigate('/admin/login');
    } finally {
      setLoading(false);
    }
  }, [navigate, vehicleFilter]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      const token = localStorage.getItem('admin_token');
      try {
        const res = await api.getAdminDrivers('all', token, 'all', searchQuery);
        setSearchResults(res.drivers || []);
      } catch (err) {
        console.error('[AdminSearch] Error:', err);
      } finally {
        setIsSearching(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    fetchData();

    // Setup real-time updates and SOS monitoring
    const token = localStorage.getItem('admin_token');
    if (token) {
      const socket = connectSocket();
      socket.emit('admin:register', { token });

      socket.on('admin:driverUpdated', fetchData);
      socket.on('driver:sos', (data) => {
        // Alert the admin and refresh stats immediately
        console.warn('CRITICAL: Driver SOS received', data);
        fetchData();
      });

      return () => {
        socket.off('admin:driverUpdated');
        socket.off('driver:sos');
      };
    }
  }, [fetchData]);

  const handleClearSos = async (id) => {
    const token = localStorage.getItem('admin_token');
    try {
      await api.clearSos(id, token);
      fetchData(); // Refresh list and counts
    } catch (err) {
      alert('Failed to clear SOS status. Driver might have already disconnected.');
    }
  };

  const handleLogout = () => {
    if (window.confirm('Are you sure you want to sign out from the Admin Dashboard?')) {
      localStorage.removeItem('admin_token');
      navigate('/admin/login');
    }
  };

  if (loading) return <div className="admin-loading-screen"><span className="spinner" /> Loading Admin Panel...</div>;

  const logoutButton = (
    <button className="header__icon-btn" onClick={handleLogout} aria-label="Sign Out" style={{ color: 'var(--danger)' }}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
        <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/>
      </svg>
    </button>
  );

  return (
    <div className="app">
      <Header title="Admin Dashboard" showBack onBack={() => navigate('/')} rightElement={logoutButton} />
      <div className="page admin-dashboard-page" style={{ padding: '16px' }}>
        
        {error && <div className="admin-error-banner">⚠️ {error}</div>}

        {/* Vehicle Type Filter: High-level segmentation for fleet management */}
        <div className="admin-filter-bar" style={{ display: 'flex', gap: '8px', marginBottom: '16px', overflowX: 'auto', paddingBottom: '4px' }}>
          {['all', 'bus', 'auto', 'cab'].map(type => (
            <button key={type} 
                    className={`chip ${vehicleFilter === type ? 'active' : ''}`}
                    onClick={() => setVehicleFilter(type)}
                    style={{ margin: 0, textTransform: 'capitalize', fontSize: '12px', minWidth: '70px', justifyContent: 'center' }}>
              {type}
            </button>
          ))}
        </div>

        {/* Quick Search Section */}
        <div className="admin-search-wrap" style={{ marginBottom: '20px' }}>
          <div style={{ position: 'relative' }}>
            <input 
              className="input"
              style={{ paddingLeft: '38px', height: '48px', borderRadius: '12px', border: '1px solid var(--gray-200)' }}
              placeholder="Search driver by name or vehicle..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
            <div style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '18px', opacity: 0.5 }}>🔍</div>
            {isSearching && <span className="spinner" style={{ position: 'absolute', right: '12px', top: '16px', width: '16px', height: '16px' }} />}
          </div>

          {searchResults.length > 0 && (
            <div className="card" style={{ marginTop: '8px', padding: '4px', maxHeight: '240px', overflowY: 'auto', border: '1px solid var(--gray-100)', boxShadow: '0 8px 24px rgba(0,0,0,0.08)' }}>
              {searchResults.map(d => (
                <div key={d._id} className="admin-search-item" onClick={() => navigate(`/admin/drivers?id=${d._id}`)}
                  style={{ padding: '12px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', borderBottom: '1px solid var(--gray-50)' }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--blue-50)', color: 'var(--blue-600)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '12px' }}>
                    {d.name?.[0]}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--gray-900)' }}>{d.name}</div>
                    <div style={{ fontSize: '11px', color: 'var(--gray-400)' }}>{d.vehicleId} • {d.vehicleNumber}</div>
                  </div>
                  <div className={`badge badge--${d.onDuty ? 'green' : 'gray'}`} style={{ fontSize: '9px' }}>
                    {d.onDuty ? 'ONLINE' : 'OFFLINE'}
                  </div>
                </div>
              ))}
            </div>
          )}
          {searchQuery.trim() && !isSearching && searchResults.length === 0 && (
            <div style={{ padding: '12px', textAlign: 'center', fontSize: '12px', color: 'var(--gray-400)' }}>
              No results found for "{searchQuery}"
            </div>
          )}
        </div>

        {/* SOS Alert Section */}
        {stats?.sosAlerts > 0 && (
          <div className="admin-sos-card" style={{ background: 'var(--danger)', color: 'white', padding: '16px', borderRadius: '12px', marginBottom: '20px', boxShadow: '0 8px 16px rgba(220, 38, 38, 0.3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: sosDrivers.length > 0 ? '16px' : 0 }}>
              <span style={{ fontSize: '32px', animation: 'pulse 1s infinite' }}>🚨</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 800, fontSize: '18px', letterSpacing: '0.5px' }}>{stats.sosAlerts} ACTIVE SOS ALERTS</div>
                <div style={{ fontSize: '13px', opacity: 0.9 }}>Emergency assistance required</div>
              </div>
              <button className="btn btn--ghost" style={{ color: 'white', border: '1px solid rgba(255,255,255,0.4)', padding: '6px 10px', fontSize: '10px' }} onClick={() => navigate('/admin/drivers?status=sos')}>ALL ➔</button>
            </div>
            
            {sosDrivers.map(d => (
              <div key={d._id} style={{ background: 'rgba(255,255,255,0.1)', borderRadius: '8px', padding: '10px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '14px' }}>{d.name}</div>
                  <div style={{ fontSize: '11px', opacity: 0.8 }}>{d.vehicleId} · {d.vehicleNumber}</div>
                </div>
                <button 
                  style={{ background: 'white', color: 'var(--danger)', border: 'none', padding: '6px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: 800, cursor: 'pointer' }}
                  onClick={() => handleClearSos(d._id)}>
                  CLEAR SOS
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="admin-stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', marginBottom: '20px' }}>
          <StatCard label="Total Users" value={stats?.totalUsers} icon="👥" />
          <StatCard label="Total Drivers" value={stats?.totalDrivers} icon="🚕" />
          <StatCard label="Pending" value={stats?.pendingDrivers} icon="⏳" highlight={stats?.pendingDrivers > 0} onClick={() => navigate('/admin/drivers?status=pending')} />
          <StatCard label="On-Duty" value={stats?.activeDrivers} icon="🟢" />
          <StatCard label="Today's Rides" value={stats?.todayBookings} icon="📅" />
          <StatCard label="Completed" value={stats?.completedBookings} icon="✅" />
        </div>

        <div className="admin-actions-list" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <button className="btn btn--secondary btn--full" style={{ justifyContent: 'space-between', padding: '16px' }} onClick={() => navigate('/admin/drivers')}>Manage Drivers <span>➔</span></button>
          <button className="btn btn--secondary btn--full" style={{ justifyContent: 'space-between', padding: '16px' }} onClick={() => navigate('/admin/users')}>User Directory <span>➔</span></button>
          <button className="btn btn--secondary btn--full" style={{ justifyContent: 'space-between', padding: '16px' }} onClick={() => navigate('/admin/bookings')}>Booking History <span>➔</span></button>
          
          <div style={{ marginTop: '12px', borderTop: '1px solid var(--gray-100)', paddingTop: '12px' }}>
            <button className="btn btn--danger btn--full" style={{ padding: '16px', fontWeight: 700 }} onClick={handleLogout}>Sign Out</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon, highlight, onClick }) {
  return (
    <div className={`card admin-stat-item ${highlight ? 'highlight' : ''}`} onClick={onClick} style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px', cursor: onClick ? 'pointer' : 'default', border: highlight ? '2px solid var(--warning)' : '1px solid var(--gray-100)' }}>
      <div style={{ fontSize: '20px' }}>{icon}</div>
      <div>
        <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--gray-900)' }}>{value ?? 0}</div>
        <div style={{ fontSize: '12px', color: 'var(--gray-400)', fontWeight: 600, textTransform: 'uppercase' }}>{label}</div>
      </div>
    </div>
  );
}