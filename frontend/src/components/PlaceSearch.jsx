import { useState, useRef, useEffect, useCallback } from 'react';
import { searchPlaces } from '../services/geocoding';
import './PlaceSearch.css';

const RECENT_KEY = 'mg_recent';
const getRecent  = () => { try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); } catch { return []; } };
const saveRecent = (p) => {
  const list = getRecent().filter(r => r.id !== p.id).slice(0, 4);
  list.unshift(p);
  localStorage.setItem(RECENT_KEY, JSON.stringify(list));
};

export default function PlaceSearch({ placeholder, value, onSelect, dotColor = 'var(--green-600)', autoFocus }) {
  const [query,   setQuery]   = useState(value || '');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open,    setOpen]    = useState(false);
  const [recent,  setRecent]  = useState(getRecent);
  const debounce = useRef(null);
  const inputRef = useRef(null);
  const wrapRef  = useRef(null);

  useEffect(() => { if (value !== undefined) setQuery(value); }, [value]);
  useEffect(() => { if (autoFocus) inputRef.current?.focus(); }, [autoFocus]);

  useEffect(() => {
    const handler = e => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const search = useCallback((val) => {
    setQuery(val);
    if (!val.trim() || val.length < 2) { setResults([]); setOpen(recent.length > 0); return; }
    clearTimeout(debounce.current);
    setLoading(true);
    debounce.current = setTimeout(async () => {
      const res = await searchPlaces(val);
      setResults(res);
      setOpen(true);
      setLoading(false);
    }, 380);
  }, [recent]);

  const select = (place) => {
    setQuery(place.name);
    setOpen(false);
    setResults([]);
    saveRecent(place);
    setRecent(getRecent());
    onSelect?.(place);
  };

  const clear = () => { setQuery(''); setResults([]); setOpen(false); onSelect?.(null); inputRef.current?.focus(); };

  const showRecent  = open && !query.trim() && recent.length > 0;
  const showResults = open && query.trim() && results.length > 0;
  const showEmpty   = open && query.trim().length > 1 && !loading && results.length === 0;

  return (
    <div className="ps-wrap" ref={wrapRef}>
      <div className={`ps-field ${open ? 'ps-field--open' : ''}`}>
        <span className="ps-dot" style={{ background: dotColor }} />
        <input
          ref={inputRef}
          className="ps-input"
          value={query}
          onChange={e => search(e.target.value)}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          autoComplete="off"
          spellCheck={false}
        />
        {loading && <span className="spinner" style={{ width: 14, height: 14, borderWidth: 1.5 }} />}
        {!loading && query && (
          <button className="ps-clear" onClick={clear} type="button">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        )}
      </div>

      {(showRecent || showResults || showEmpty) && (
        <div className="ps-dropdown">
          {showRecent && (
            <>
              <div className="ps-group-label">Recent</div>
              {recent.map(r => (
                <button key={r.id} className="ps-item" onClick={() => select(r)}>
                  <svg className="ps-item-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                  <div className="ps-item-text">
                    <span className="ps-item-name">{r.name}</span>
                  </div>
                </button>
              ))}
            </>
          )}
          {showResults && results.map(r => (
            <button key={r.id} className="ps-item" onClick={() => select(r)}>
              <svg className="ps-item-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
              <div className="ps-item-text">
                <span className="ps-item-name">{r.name}</span>
                <span className="ps-item-sub">{r.fullName}</span>
              </div>
            </button>
          ))}
          {showEmpty && <div className="ps-empty">No results for "{query}"</div>}
        </div>
      )}
    </div>
  );
}
