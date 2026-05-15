import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import './DriverRegister.css';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

const VEHICLE_TYPES = [
  { id: 'bus',  emoji: '🚌', label: 'Bus',           desc: 'City / intercity bus service' },
  { id: 'auto', emoji: '🛺', label: 'Auto Rickshaw', desc: 'Up to 3 passengers'           },
  { id: 'cab',  emoji: '🚕', label: 'Cab / Taxi',    desc: 'Up to 4 passengers'           },
  { id: 'bike', emoji: '🏍️', label: 'Bike Taxi',     desc: 'Solo passenger rides'          },
];

const STEPS = ['Personal', 'Vehicle', 'Security'];

function Field({ label, hint, optional, children }) {
  return (
    <div className="dreg2-field">
      <label className="dreg2-label">
        {label}
        {optional && <span className="dreg2-opt"> (optional)</span>}
      </label>
      {children}
      {hint && <span className="dreg2-hint">{hint}</span>}
    </div>
  );
}

export default function DriverRegister() {
  const navigate  = useNavigate();
  const [step,    setStep]    = useState(1);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const [result,  setResult]  = useState(null);
  const [animDir, setAnimDir] = useState('forward'); // forward | back
  const firstRef  = useRef(null);

  const [form, setForm] = useState({
    name:          '',
    phone:         '',
    email:         '',
    address:       '',
    licenseNumber: '',
    vehicleType:   '',
    vehicleNumber: '',
    busName:       '',
    routeFrom:     '',
    routeTo:       '',
    routeNumber:   '',
    pin:           '',
    confirmPin:    '',
  });

  const set = (key, val) => { setForm(f => ({ ...f, [key]: val })); setError(''); };

  useEffect(() => { firstRef.current?.focus(); }, [step]);

  // ── Validation ────────────────────────────────────────────
  const validate = {
    1: () => {
      if (!form.name.trim())  return 'Full name is required.';
      if (!form.phone.trim()) return 'Phone number is required.';
      if (form.phone.replace(/\D/g,'').length < 10) return 'Enter a valid 10-digit phone number.';
      return null;
    },
    2: () => {
      if (!form.vehicleType)          return 'Please select your vehicle type.';
      if (!form.vehicleNumber.trim()) return 'Vehicle registration number is required.';
      if (form.vehicleType === 'bus') {
        if (!form.busName.trim())   return 'Bus name is required.';
        if (!form.routeFrom.trim()) return 'Route start point is required.';
        if (!form.routeTo.trim())   return 'Route end point is required.';
      }
      return null;
    },
    3: () => {
      if (!/^\d{4}$/.test(form.pin))   return 'PIN must be exactly 4 digits.';
      if (form.pin !== form.confirmPin) return 'PINs do not match. Please re-enter.';
      return null;
    },
  };

  const goNext = () => {
    const err = validate[step]?.();
    if (err) { setError(err); return; }
    if (step < 3) { setAnimDir('forward'); setStep(s => s + 1); }
  };

  const goBack = () => {
    if (step > 1 && step < 4) { setAnimDir('back'); setStep(s => s - 1); setError(''); }
    else navigate(-1);
  };

  const handleSubmit = async () => {
    const err = validate[3]?.();
    if (err) { setError(err); return; }
    setLoading(true); setError('');
    try {
      const res = await fetch(`${API}/driver/register`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:          form.name.trim(),
          phone:         form.phone.trim(),
          email:         form.email.trim(),
          address:       form.address.trim(),
          licenseNumber: form.licenseNumber.trim(),
          vehicleType:   form.vehicleType,
          vehicleNumber: form.vehicleNumber.trim().toUpperCase(),
          busName:       form.busName.trim(),
          routeFrom:     form.routeFrom.trim(),
          routeTo:       form.routeTo.trim(),
          routeNumber:   form.routeNumber.trim(),
          pin:           form.pin,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message || 'Registration failed.'); return; }
      setResult(data);
      setStep(4);
    } catch {
      setError('Cannot connect to server. Please check your connection.');
    } finally { setLoading(false); }
  };

  const isBus = form.vehicleType === 'bus';

  // ── Success Screen ────────────────────────────────────────
  if (step === 4 && result) return (
    <div className="dreg2-page">
      <div className="dreg2-wrap">
        <div className="dreg2-success">
          <div className="dreg2-success__burst">
            <div className="dreg2-success__ring dreg2-success__ring--1"/>
            <div className="dreg2-success__ring dreg2-success__ring--2"/>
            <div className="dreg2-success__icon">✓</div>
          </div>

          <h2 className="dreg2-success__title">You're registered!</h2>
          <p className="dreg2-success__sub">
            Your application has been sent to admin for review. You'll be able to sign in once approved.
          </p>

          <div className="dreg2-success__id-box">
            <div className="dreg2-success__id-label">Your Vehicle ID</div>
            <div className="dreg2-success__id-val">{result.vehicleId}</div>
            <div className="dreg2-success__id-note">
              📌 Save this ID — you'll need it every time you sign in
            </div>
          </div>

          <div className="dreg2-success__timeline">
            {[
              { icon: '📋', text: 'Application submitted',        done: true  },
              { icon: '🔍', text: 'Admin reviews (24–48 hrs)',     done: false },
              { icon: '✅', text: 'You get approved & notified',  done: false },
              { icon: '🚗', text: 'Sign in with Vehicle ID + PIN', done: false },
            ].map((t, i) => (
              <div key={i} className={`dreg2-success__tl-row ${t.done ? 'done' : ''}`}>
                <div className="dreg2-success__tl-icon">{t.icon}</div>
                <div className="dreg2-success__tl-text">{t.text}</div>
                {t.done && <div className="dreg2-success__tl-check">✓</div>}
              </div>
            ))}
          </div>

          <button className="dreg2-btn dreg2-btn--primary" onClick={() => navigate('/')}>
            Back to Home
          </button>
          <button className="dreg2-btn dreg2-btn--ghost" onClick={() => navigate('/driver')}>
            Go to Driver Sign In
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="dreg2-page">
      <div className="dreg2-wrap">

        {/* ── Top bar ─────────────────────────────── */}
        <div className="dreg2-topbar">
          <button className="dreg2-back-btn" onClick={goBack}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M19 12H5M12 5l-7 7 7 7"/>
            </svg>
          </button>
          <div className="dreg2-brand">
            MoveOn<span>Go</span>
            <div className="dreg2-brand-sub">Driver Registration</div>
          </div>
          <div style={{width:36}}/>
        </div>

        {/* ── Progress bar ─────────────────────────── */}
        <div className="dreg2-progress">
          <div className="dreg2-progress__track">
            <div className="dreg2-progress__fill" style={{width:`${((step-1)/3)*100}%`}}/>
          </div>
          <div className="dreg2-progress__steps">
            {STEPS.map((s, i) => (
              <div key={i} className={`dreg2-progress__step ${step > i+1 ? 'done' : step === i+1 ? 'active' : ''}`}>
                <div className="dreg2-progress__dot">
                  {step > i+1 ? '✓' : i+1}
                </div>
                <span>{s}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Card ─────────────────────────────────── */}
        <div className={`dreg2-card dreg2-card--${animDir}`} key={step}>

          {/* ── STEP 1: Personal Details ─────────── */}
          {step === 1 && (
            <>
              <div className="dreg2-card__head">
                <div className="dreg2-card__icon">👤</div>
                <h2 className="dreg2-card__title">Personal Details</h2>
                <p className="dreg2-card__sub">Let's start with your basic information</p>
              </div>

              <Field label="Full Name">
                <input ref={firstRef} className="dreg2-input" value={form.name}
                  onChange={e => set('name', e.target.value)}
                  placeholder="e.g. Suresh Kumar Panda" autoComplete="name"/>
              </Field>

              <Field label="Phone Number" hint="We'll use this for account verification">
                <div className="dreg2-phone-wrap">
                  <div className="dreg2-phone-prefix">🇮🇳 +91</div>
                  <input className="dreg2-input dreg2-input--phone" type="tel"
                    value={form.phone} onChange={e => set('phone', e.target.value)}
                    placeholder="98765 43210" maxLength={15}/>
                </div>
              </Field>

              <Field label="Email Address" optional>
                <input className="dreg2-input" type="email" value={form.email}
                  onChange={e => set('email', e.target.value)}
                  placeholder="your@email.com"/>
              </Field>

              <Field label="Home Address" optional>
                <input className="dreg2-input" value={form.address}
                  onChange={e => set('address', e.target.value)}
                  placeholder="e.g. Bhubaneswar, Odisha"/>
              </Field>

              <Field label="Driving License Number" optional hint="Format: OD followed by 13 digits">
                <input className="dreg2-input" value={form.licenseNumber}
                  onChange={e => set('licenseNumber', e.target.value.toUpperCase())}
                  placeholder="e.g. OD0120210012345"
                  style={{letterSpacing:'0.5px'}}/>
              </Field>
            </>
          )}

          {/* ── STEP 2: Vehicle Details ──────────── */}
          {step === 2 && (
            <>
              <div className="dreg2-card__head">
                <div className="dreg2-card__icon">🚗</div>
                <h2 className="dreg2-card__title">Vehicle Details</h2>
                <p className="dreg2-card__sub">Tell us about the vehicle you'll be driving</p>
              </div>

              <Field label="Vehicle Type">
                <div className="dreg2-veh-grid">
                  {VEHICLE_TYPES.map(v => (
                    <button key={v.id} type="button"
                      className={`dreg2-veh-card ${form.vehicleType === v.id ? 'selected' : ''}`}
                      onClick={() => set('vehicleType', v.id)}>
                      <div className="dreg2-veh-emoji">{v.emoji}</div>
                      <div className="dreg2-veh-label">{v.label}</div>
                      <div className="dreg2-veh-desc">{v.desc}</div>
                      {form.vehicleType === v.id && <div className="dreg2-veh-check">✓</div>}
                    </button>
                  ))}
                </div>
              </Field>

              <Field label="Vehicle Registration Number" hint="Enter the number plate exactly as printed">
                <input ref={firstRef} className="dreg2-input dreg2-input--plate"
                  value={form.vehicleNumber}
                  onChange={e => set('vehicleNumber', e.target.value.toUpperCase())}
                  placeholder="e.g. OD-05-AB-1234"/>
              </Field>

              {/* ✅ Bus-specific fields — only shown when bus is selected */}
              {isBus && (
                <div className="dreg2-bus-section">
                  <div className="dreg2-bus-section__label">
                    <span className="dreg2-bus-section__dot"/>
                    Bus Route Information
                  </div>

                  <Field label="Bus Name" hint="The official name shown to passengers on the map">
                    <input className="dreg2-input" value={form.busName}
                      onChange={e => set('busName', e.target.value)}
                      placeholder="e.g. Bhubaneswar City Express"/>
                  </Field>

                  <div className="dreg2-route-row">
                    <Field label="Route From">
                      <input className="dreg2-input" value={form.routeFrom}
                        onChange={e => set('routeFrom', e.target.value)}
                        placeholder="e.g. Bhubaneswar"/>
                    </Field>
                    <div className="dreg2-route-arrow">→</div>
                    <Field label="Route To">
                      <input className="dreg2-input" value={form.routeTo}
                        onChange={e => set('routeTo', e.target.value)}
                        placeholder="e.g. Cuttack"/>
                    </Field>
                  </div>

                  <Field label="Route Number" optional hint="e.g. Route 12, 14A, etc.">
                    <input className="dreg2-input" value={form.routeNumber}
                      onChange={e => set('routeNumber', e.target.value.toUpperCase())}
                      placeholder="e.g. Route 14A"/>
                  </Field>
                </div>
              )}
            </>
          )}

          {/* ── STEP 3: Security PIN ─────────────── */}
          {step === 3 && (
            <>
              <div className="dreg2-card__head">
                <div className="dreg2-card__icon">🔐</div>
                <h2 className="dreg2-card__title">Set Your PIN</h2>
                <p className="dreg2-card__sub">You'll enter this every time you sign in to the driver panel</p>
              </div>

              <Field label="Create 4-Digit PIN" hint="Use a PIN only you know — don't use 1234 or 0000">
                <div className="dreg2-pin-wrap">
                  <input ref={firstRef} className="dreg2-input dreg2-input--pin"
                    type="password" inputMode="numeric" maxLength={4}
                    value={form.pin}
                    onChange={e => set('pin', e.target.value.replace(/\D/g,'').slice(0,4))}
                    placeholder="••••"/>
                  <div className="dreg2-pin-dots">
                    {[0,1,2,3].map(i => (
                      <div key={i} className={`dreg2-pin-dot ${form.pin.length > i ? 'filled' : ''}`}/>
                    ))}
                  </div>
                </div>
              </Field>

              <Field label="Confirm PIN">
                <div className="dreg2-pin-wrap">
                  <input className="dreg2-input dreg2-input--pin"
                    type="password" inputMode="numeric" maxLength={4}
                    value={form.confirmPin}
                    onChange={e => set('confirmPin', e.target.value.replace(/\D/g,'').slice(0,4))}
                    placeholder="••••"/>
                  <div className="dreg2-pin-dots">
                    {[0,1,2,3].map(i => (
                      <div key={i} className={`dreg2-pin-dot ${form.confirmPin.length > i ? 'filled' : ''} ${form.confirmPin.length > i && form.pin[i] === form.confirmPin[i] ? 'match' : ''}`}/>
                    ))}
                  </div>
                </div>
              </Field>

              {/* Registration summary */}
              <div className="dreg2-summary">
                <div className="dreg2-summary__title">Registration Summary</div>
                {[
                  ['Name',         form.name],
                  ['Phone',        form.phone],
                  ['Vehicle Type', VEHICLE_TYPES.find(v=>v.id===form.vehicleType)?.label || '—'],
                  ['Vehicle No.',  form.vehicleNumber],
                  ...(isBus ? [
                    ['Bus Name',   form.busName],
                    ['Route',      form.routeFrom && form.routeTo ? `${form.routeFrom} → ${form.routeTo}` : '—'],
                  ] : []),
                ].map(([k,v], i) => (
                  <div key={i} className="dreg2-summary__row">
                    <span className="dreg2-summary__key">{k}</span>
                    <span className="dreg2-summary__val">{v || '—'}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* ── Error ────────────────────────────── */}
          {error && (
            <div className="dreg2-error">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              {error}
            </div>
          )}

          {/* ── Actions ──────────────────────────── */}
          <div className="dreg2-actions">
            {step < 3 ? (
              <button className="dreg2-btn dreg2-btn--primary" onClick={goNext}>
                Continue
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
              </button>
            ) : (
              <button className="dreg2-btn dreg2-btn--primary" onClick={handleSubmit} disabled={loading}>
                {loading
                  ? <><span className="dreg2-spinner"/>Submitting...</>
                  : <>Submit Registration ✓</>
                }
              </button>
            )}
          </div>
        </div>

        {step === 1 && (
          <p className="dreg2-signin-note">
            Already registered?{' '}
            <button className="dreg2-signin-link" onClick={() => navigate('/driver')}>
              Sign In →
            </button>
          </p>
        )}

      </div>
    </div>
  );
}