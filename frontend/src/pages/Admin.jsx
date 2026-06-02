import { useState, useEffect } from 'react';
import api from '../services/api';
import { connectSocket } from '../services/socket';
import './Admin.css';

function AdminLogin({ onLogin }) {
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const data = await api.adminLogin(password);
      localStorage.setItem('admin_token', data.token);
      onLogin(data.token);
    } catch { setError('Cannot connect to server.'); }
    finally   { setLoading(false); }
  };

  return (
    <div className="al-page">
      <div className="al-box">
        <div className="al-brand">
          <img src="/logo.svg" alt="" onError={e => e.target.style.display='none'} className="al-logo"/>
          <div>
            <h1 className="al-title">MoveOn Go</h1>
            <p className="al-sub">Admin Dashboard</p>
          </div>
        </div>
        <form onSubmit={handleLogin} className="al-form">
          <label className="al-label">Admin Password</label>
          <input className="input" type="password" value={password}
            onChange={e => { setPassword(e.target.value); setError(''); }}
            placeholder="Enter admin password" autoFocus/>
          {error && <p className="al-error">{error}</p>}
          <button className="btn btn--primary btn--full btn--lg" type="submit" disabled={loading || !password}>
            {loading ? 'Signing in...' : 'Sign In →'}
          </button>
        </form>
      </div>
    </div>
  );
}

function formatLastSeen(dateStr) {
  if (!dateStr) return '—';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return new Date(dateStr).toLocaleDateString('en-IN');
}

function Dashboard({ token, onLogout }) {
  const [tab,      setTab]      = useState('overview');
  const [stats,    setStats]    = useState(null);
  const [drivers,  setDrivers]  = useState([]);
  const [users,    setUsers]    = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading,  setLoading]  = useState(false);
  const [msg,      setMsg]      = useState({ text:'', type:'' });

  const showMsg = (text, type='success') => {
    setMsg({ text, type });
    setTimeout(() => setMsg({ text:'', type:'' }), 5000);
  };

  const load = async (section) => {
    setLoading(true);
    try {
      if (section === 'overview' || section === 'all') {
        const s = await api.getAdminStats(token);
        setStats(s);
      }
      if (section === 'drivers' || section === 'all') {
        const d = await api.getAdminDrivers('all', token);
        setDrivers(d.drivers || []);
      }
      if (section === 'users' || section === 'all') {
        const u = await api.getAdminUsers(token);
        setUsers(u.users || []);
      }
      if (section === 'bookings' || section === 'all') {
        const b = await api.getAdminBookings(token);
        setBookings(b.bookings || []);
      }
    } catch (err) {
      if (err.message.toLowerCase().includes('token') || err.message.toLowerCase().includes('authenticated')) onLogout();
    } finally { setLoading(false); }
  };

  // ✅ REAL-TIME UPDATES: Register admin for socket events
  useEffect(() => {
    if (!token) return;
    const socket = connectSocket();
    socket.emit('admin:register', { token });

    const handleDriverUpdate = (data) => {
      showMsg(`🔔 Real-time: New driver ${data.action}!`);
      load(tab); // Refresh current view automatically
    };

    socket.on('admin:driverUpdated', handleDriverUpdate);
    return () => socket.off('admin:driverUpdated', handleDriverUpdate);
  }, [token, tab]);

  useEffect(() => { load(tab); }, [token, tab]);

  const approve = async (id, name, vehicleId) => {
    try {
      await api.approveDriver(id, token);
      showMsg(`✅ ${name} approved! Vehicle ID: ${vehicleId}`);
      load(tab);
    } catch (err) { showMsg(`❌ ${err.message}`, 'error'); }
  };

  const reject = async (id, name) => {
    if (!window.confirm(`Reject ${name}? This cannot be undone.`)) return;
    try {
      await api.rejectDriver(id, 'Rejected by admin', token);
      showMsg(`Driver ${name} rejected.`);
      load(tab);
    } catch (err) { showMsg(`❌ ${err.message}`, 'error'); }
  };

  const deleteDriver = async (id, name) => {
    if (!window.confirm(`Permanently delete ${name}?`)) return;
    try {
      await api.deleteDriver(id, token);
      showMsg(`Driver ${name} deleted.`);
      load('drivers');
    } catch (err) { showMsg(`❌ ${err.message}`, 'error'); }
  };

  const pending  = drivers.filter(d => !d.isApproved && d.isActive);
  const approved = drivers.filter(d =>  d.isApproved && d.isActive);

  const TABS = [
    { id: 'overview', label: 'Overview' },
    { id: 'drivers',  label: `Drivers${pending.length > 0 ? ` (${pending.length})` : ''}` },
    { id: 'users',    label: 'Users' },
    { id: 'bookings', label: 'Bookings' },
  ];

  return (
    <div className="ad-page">

      {/* Header */}
      <div className="ad-header">
        <div className="ad-header-brand">
          <img src="/logo.svg" alt="" onError={e=>e.target.style.display='none'} className="ad-header-logo"/>
          <span>MoveOn Go · Admin</span>
        </div>
        <div className="ad-header-right">
          <button className="ad-refresh-btn" onClick={() => load('all')} title="Refresh data">↻ Refresh</button>
          <button className="btn btn--ghost" style={{fontSize:13}} onClick={onLogout}>Sign Out</button>
        </div>
      </div>

      {/* Message */}
      {msg.text && (
        <div className={`ad-msg ad-msg--${msg.type}`}>
          <span>{msg.text}</span>
          <button onClick={() => setMsg({text:'',type:''})}>✕</button>
        </div>
      )}

      {/* Tabs */}
      <div className="ad-tabs">
        {TABS.map(t => (
          <button key={t.id} className={`ad-tab ${tab===t.id?'active':''}`} onClick={() => setTab(t.id)}>
            {t.label}
            {t.id==='drivers' && pending.length>0 && (
              <span className="ad-tab-badge">{pending.length}</span>
            )}
          </button>
        ))}
      </div>

      <div className="ad-body">

        {/* Overview */}
        {tab === 'overview' && (
          <div>
            {!stats ? (
              <div className="ad-center"><div className="spinner" style={{width:32,height:32}}/></div>
            ) : (
              <>
                <div className="ad-stats-grid">
                  {[
                    { label:'Total Users',      val: stats.totalUsers,       color:'blue'   },
                    { label:'Total Drivers',     val: stats.totalDrivers,     color:'green'  },
                    { label:'Pending Approvals', val: stats.pendingDrivers,   color: stats.pendingDrivers>0?'yellow':'gray' },
                    { label:'Active on Duty',    val: stats.activeDrivers,    color:'green'  },
                    { label:'Total Bookings',    val: stats.totalBookings,    color:'blue'   },
                    { label:'Completed Rides',   val: stats.completedBookings,color:'green'  },
                    { label:"Today's Bookings",  val: stats.todayBookings,    color:'blue'   },
                  ].map((s,i) => (
                    <div key={i} className={`ad-stat ad-stat--${s.color}`}>
                      <div className="ad-stat-val">{s.val}</div>
                      <div className="ad-stat-label">{s.label}</div>
                    </div>
                  ))}
                </div>

                {pending.length > 0 && (
                  <div className="ad-alert">
                    <div>
                      <strong>{pending.length} driver{pending.length>1?'s':''} waiting for approval</strong>
                      <p>Review and approve new driver registrations</p>
                    </div>
                    <button className="btn btn--primary" style={{fontSize:13,padding:'10px 18px',flexShrink:0}}
                      onClick={() => setTab('drivers')}>
                      Review →
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Drivers */}
        {tab === 'drivers' && (
          <div>
            {/* Pending */}
            {pending.length > 0 && (
              <div className="ad-section">
                <div className="ad-section-title">⏳ Pending Approval ({pending.length})</div>
                {pending.map(d => (
                  <div key={d._id} className="ad-driver-card ad-driver-card--pending">
                    <div className="adc-row">
                      <div className="adc-avatar">{d.name?.[0]?.toUpperCase()}</div>
                      <div className="adc-info">
                        <div className="adc-name">{d.name}</div>
                        <div className="adc-detail">{d.phone}</div>
                        {d.email && <div className="adc-detail">{d.email}</div>}
                        <div className="adc-detail">
                          <span className="adc-tag">{d.vehicleType.toUpperCase()}</span>
                          {d.vehicleNumber}
                        </div>
                        {d.address && <div className="adc-detail">📍 {d.address}</div>}
                        {d.licenseNumber && <div className="adc-detail">🪪 {d.licenseNumber}</div>}
                        <div className="adc-detail adc-date">
                          Applied: {new Date(d.createdAt).toLocaleString('en-IN')}
                        </div>
                      </div>
                    </div>
                    <div className="adc-vehicle-id-preview">
                      Vehicle ID on approval: <strong>{d.vehicleId}</strong>
                    </div>
                    <div className="adc-btns">
                      <button className="btn btn--primary" style={{flex:1}}
                        onClick={() => approve(d._id, d.name, d.vehicleId)}>
                        ✅ Approve
                      </button>
                      <button className="btn btn--danger" style={{flex:1}}
                        onClick={() => reject(d._id, d.name)}>
                        ✕ Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Approved */}
            <div className="ad-section">
              <div className="ad-section-title">✅ Approved Drivers ({approved.length})</div>
              {approved.length === 0 ? (
                <div className="ad-empty">No approved drivers yet.</div>
              ) : approved.map(d => (
                <div key={d._id} className="ad-driver-card ad-driver-card--approved">
                  <div className="adc-row">
                    <div className="adc-avatar adc-avatar--green">{d.name?.[0]?.toUpperCase()}</div>
                    <div className="adc-info">
                      <div className="adc-name">{d.name}</div>
                      <div className="adc-detail">{d.phone}</div>
                      <div className="adc-detail">
                        <span className="adc-tag">{d.vehicleType.toUpperCase()}</span>
                        {d.vehicleNumber}
                      </div>
                      <div className="adc-detail">ID: <strong>{d.vehicleId}</strong></div>
                      <div className="adc-detail">
                        <span className={d.onDuty ? 'adc-online' : 'adc-offline'}>
                          {d.onDuty ? '🟢 On Duty' : '⚫ Offline'}
                        </span>
                        &nbsp;·&nbsp; ⭐ {d.rating} &nbsp;·&nbsp; {d.totalTrips} trips
                      </div>
                    </div>
                  </div>
                  <div className="adc-btns">
                    <button className="btn btn--danger" style={{fontSize:12,padding:'8px 14px'}}
                      onClick={() => deleteDriver(d._id, d.name)}>
                      Delete Driver
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Users */}
        {tab === 'users' && (
          <div className="ad-section">
            <div className="ad-section-title">All Users ({users.length})</div>
            {users.length === 0 ? (
              <div className="ad-empty">No users registered yet.</div>
            ) : (
              <div className="ad-table">
                <div className="ad-table-head">
                  <span>Phone</span>
                  <span>Name</span>
                  <span>Joined</span>
                  <span>Last Active</span>
                </div>
                {users.map(u => (
                  <div key={u._id} className="ad-table-row">
                    <span>{u.phone}</span>
                    <span>{u.name || '—'}</span>
                    <span>{new Date(u.createdAt).toLocaleDateString('en-IN')}</span>
                    <span className={Date.now() - new Date(u.lastSeen).getTime() < 300000 ? 'adc-online' : ''}>
                      {formatLastSeen(u.lastSeen)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Bookings */}
        {tab === 'bookings' && (
          <div className="ad-section">
            <div className="ad-section-title">All Bookings ({bookings.length})</div>
            {bookings.length === 0 ? (
              <div className="ad-empty">No bookings yet.</div>
            ) : bookings.map(b => (
              <div key={b._id} className="ad-booking card">
                <div className="ab-top">
                  <span className={`badge ${b.status==='completed'?'badge--green':b.status==='cancelled'?'badge--red':'badge--blue'}`}>
                    {b.status}
                  </span>
                  <span className="ab-type">{b.vehicleType}</span>
                  <span className="ab-date">{new Date(b.createdAt).toLocaleString('en-IN')}</span>
                </div>
                <div className="ab-route">
                  <span>📍 {b.pickup}</span>
                  <span className="ab-arrow">→</span>
                  <span>🏁 {b.dropoff}</span>
                </div>
                <div className="ab-meta">
                  {b.userId  && <span>👤 {b.userId.phone  || b.userId.name  || '—'}</span>}
                  {b.driverId && <span>🚗 {b.driverId.name || '—'} · {b.driverId.vehicleNumber || '—'}</span>}
                  {b.fare     && <span>💰 {b.fare}</span>}
                  {b.distance && <span>📏 {b.distance}</span>}
                  {b.payment  && <span>💳 {b.payment}</span>}
                </div>
              </div>
            ))}
          </div>
        )}

        {loading && (
          <div className="ad-center" style={{marginTop:20}}>
            <div className="spinner" style={{width:20,height:20}}/>
          </div>
        )}

      </div>
    </div>
  );
}

export default function Admin() {
  const [token, setToken] = useState(() => localStorage.getItem('admin_token') || '');
  const handleLogout = () => { localStorage.removeItem('admin_token'); setToken(''); };
  if (!token) return <AdminLogin onLogin={setToken} />;
  return <Dashboard token={token} onLogout={handleLogout} />;
}
