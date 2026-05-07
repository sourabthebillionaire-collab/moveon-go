import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import BottomNav from '../components/BottomNav';
import PlaceSearch from '../components/PlaceSearch';
import { getFavourites, addFavourite, removeFavourite } from '../services/storage';
import './Favourites.css';

export default function Favourites() {
  const navigate = useNavigate();
  const [favs,    setFavs]    = useState([]);
  const [adding,  setAdding]  = useState(false);
  const [newPlace,setNewPlace]= useState(null);
  const [label,   setLabel]   = useState('');

  useEffect(() => { setFavs(getFavourites()); }, []);

  const handleAdd = () => {
    if (!newPlace) return;
    addFavourite({ ...newPlace, label: label || newPlace.name });
    setFavs(getFavourites());
    setAdding(false);
    setNewPlace(null);
    setLabel('');
  };

  const handleRemove = (id) => {
    removeFavourite(id);
    setFavs(getFavourites());
  };

  return (
    <div className="app">
      <Header title="Saved Places" showBack onBack={() => navigate(-1)} />
      <div className="page">
        <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 10 }}>

          <button className="btn btn--secondary btn--full" onClick={() => setAdding(v => !v)}>
            {adding ? 'Cancel' : '+ Save a Place'}
          </button>

          {adding && (
            <div className="card fav-add slide-up">
              <p style={{ fontSize: 13, color: 'var(--gray-500)', marginBottom: 10 }}>Search for a location to save</p>
              <PlaceSearch placeholder="Search place..." onSelect={p => setNewPlace(p)} autoFocus />
              {newPlace && (
                <>
                  <input className="input" style={{ marginTop: 10 }} placeholder="Label (e.g. Home, Office)" value={label} onChange={e => setLabel(e.target.value)} />
                  <button className="btn btn--primary btn--full" style={{ marginTop: 10 }} onClick={handleAdd}>
                    Save Place
                  </button>
                </>
              )}
            </div>
          )}

          {favs.length === 0 && !adding ? (
            <div className="empty" style={{ paddingTop: 60 }}>
              <div className="empty__icon">⭐</div>
              <div className="empty__title">No saved places</div>
              <div className="empty__sub">Save your home, office or frequent stops for quick access</div>
            </div>
          ) : (
            favs.map(fav => (
              <div key={fav.id} className="card fav-item">
                <div className="fav-item-top">
                  <div className="fav-item-icon">📍</div>
                  <div className="fav-item-info">
                    <div className="fav-item-label">{fav.label || fav.name}</div>
                    <div className="fav-item-name">{fav.name}</div>
                  </div>
                  <button className="fav-remove" onClick={() => handleRemove(fav.id)}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M18 6L6 18M6 6l12 12"/>
                    </svg>
                  </button>
                </div>
                <div className="fav-actions">
                  <button className="btn btn--secondary" style={{ flex: 1, fontSize: 12, padding: '8px' }}
                    onClick={() => navigate('/map', { state: { to: fav, toLabel: fav.label || fav.name } })}>
                    Show on Map
                  </button>
                  <button className="btn btn--primary" style={{ flex: 1, fontSize: 12, padding: '8px' }}
                    onClick={() => navigate('/book', { state: { dropoff: fav.name, dropoffCoords: fav } })}>
                    Book Ride Here
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
      <BottomNav />
    </div>
  );
}
