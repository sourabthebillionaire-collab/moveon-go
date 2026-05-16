// BusList.jsx
import { useState, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Header from '../components/Header';
import BottomNav from '../components/BottomNav';
import api from '../services/api';
import { useEffect } from 'react';
import './BusList.css';

export default function BusList() {
  const navigate = useNavigate();
  const state    = useLocation().state || {};
  const [search,  setSearch]  = useState(state.q || '');
  const [filter,  setFilter]  = useState('all');
  const [buses,   setBuses]   = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const data = await api.getBusRoutes();
        setBuses(data.routes || []);
      } catch {
        setBuses([]); // no demo data
      } finally { setLoading(false); }
    })();
  }, []);

  const filtered = useMemo(() => {
    let list = buses;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(b => b.number?.toLowerCase().includes(q) || b.from?.toLowerCase().includes(q) || b.to?.toLowerCase().includes(q));
    }
    if (filter === 'active')  list = list.filter(b => b.status === 'active');
    if (filter === 'delayed') list = list.filter(b => b.status === 'delayed');
    if (filter === 'ac')      list = list.filter(b => b.type === 'AC');
    return list;
  }, [buses, search, filter]);

  return (
    <div className="app">
      <Header title="Bus Tracker" />
      <div className="page">
        <div className="bl-top">
          <div className="bl-searchbar">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            <input className="bl-searchinput" placeholder="Search bus, route or stop..." value={search} onChange={e => setSearch(e.target.value)} autoFocus={!!state.q}/>
            {search && <button className="bl-clear" onClick={() => setSearch('')}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg></button>}
          </div>
          <div className="chips" style={{paddingTop:10}}>
            {[['all','All'],['active','Active'],['delayed','Delayed'],['ac','AC']].map(([id,label]) => (
              <button key={id} className={`chip ${filter===id?'active':''}`} onClick={() => setFilter(id)}>{label}</button>
            ))}
          </div>
          <div className="bl-count">{filtered.length} {filtered.length===1?'bus':'buses'} found</div>
        </div>

        <div style={{padding:'8px 16px',display:'flex',flexDirection:'column',gap:8}}>
          {loading && <div className="empty"><div className="spinner" style={{width:28,height:28}}/></div>}
          {!loading && filtered.length === 0 && (
            <div className="empty">
              <div className="empty__icon">🚌</div>
              <div className="empty__title">No buses active right now</div>
              <div className="empty__sub">Bus data will appear here once drivers connect to the system</div>
            </div>
          )}
          {filtered.map((bus, i) => (
            <div key={bus.id || i} className="card bl-card" onClick={() => navigate('/map', {state:{busId:bus.id}})}>
              <div className="bl-card-top">
                <div className="bl-num">{bus.number}</div>
                <div className="bl-route">{bus.from} → {bus.to}</div>
                <div className={`bl-eta ${bus.status==='delayed'?'bl-eta--late':''}`}>{bus.eta}</div>
              </div>
              <div className="bl-card-btm">
                <span className={`badge ${bus.status==='active'?'badge--green':'badge--yellow'}`}>
                  {bus.status==='active'?'Active':'Delayed'}
                </span>
                {bus.type && <span className="badge badge--blue">{bus.type}</span>}
                {typeof bus.seats === 'number' && <span className={`badge ${bus.seats===0?'badge--red':bus.seats<8?'badge--yellow':'badge--gray'}`}>{bus.seats===0?'Full':`${bus.seats} seats`}</span>}
              </div>
            </div>
          ))}
        </div>
      </div>
      <BottomNav />
    </div>
  );
}
