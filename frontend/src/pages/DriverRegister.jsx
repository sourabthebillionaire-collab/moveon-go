import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './DriverRegister.css';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

const VEHICLE_TYPES = [
  { id: 'bus',  label: 'Bus',          desc: 'City / intercity bus' },
  { id: 'auto', label: 'Auto Rickshaw', desc: 'Up to 3 passengers' },
  { id: 'cab',  label: 'Cab / Taxi',   desc: 'Up to 4 passengers' },
  { id: 'bike', label: 'Bike Taxi',    desc: '1 passenger' },
];

export default function DriverRegister() {
  const navigate = useNavigate();
  const [step,    setStep]    = useState(1); // 1=details, 2=vehicle, 3=pin, 4=success
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const [result,  setResult]  = useState(null);

  const [form, setForm] = useState({
    name:          '',
    phone:         '',
    email:         '',
    address:       '',
    licenseNumber: '',
    vehicleType:   '',
    vehicleNumber: '',
    pin:           '',
    confirmPin:    '',
  });

  const set = (key, val) => { setForm(f => ({ ...f, [key]: val })); setError(''); };

  const validateStep1 = () => {
    if (!form.name.trim())  { setError('Full name is required.'); return false; }
    if (!form.phone.trim()) { setError('Phone number is required.'); return false; }
    if (form.phone.replace(/\D/g,'').length < 10) { setError('Enter a valid 10-digit phone number.'); return false; }
    return true;
  };

  const validateStep2 = () => {
    if (!form.vehicleType)          { setError('Please select your vehicle type.'); return false; }
    if (!form.vehicleNumber.trim()) { setError('Vehicle number is required.'); return false; }
    return true;
  };

  const validateStep3 = () => {
    if (!/^\d{4}$/.test(form.pin))       { setError('PIN must be exactly 4 digits.'); return false; }
    if (form.pin !== form.confirmPin)     { setError('PINs do not match.'); return false; }
    return true;
  };

  const handleNext = () => {
    if (step === 1 && validateStep1()) setStep(2);
    if (step === 2 && validateStep2()) setStep(3);
  };

  const handleSubmit = async () => {
    if (!validateStep3()) return;
    setLoading(true);
    setError('');
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
          pin:           form.pin,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message); return; }
      setResult(data);
      setStep(4);
    } catch {
      setError('Cannot connect to server. Please check your internet connection.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dreg-page">
      <div className="dreg-container">

        {/* Header */}
        <div className="dreg-header">
          <button className="dreg-back" onClick={() => step > 1 && step < 4 ? setStep(s => s-1) : navigate(-1)}>
            ← Back
          </button>
          <h1 className="dreg-brand">MoveOn<span>Go</span></h1>
        </div>

        {/* Progress */}
        {step < 4 && (
          <div className="dreg-progress">
            {[1,2,3].map(s => (
              <div key={s} className={`dreg-step ${step >= s ? 'active' : ''} ${step > s ? 'done' : ''}`}>
                <div className="dreg-step-dot">{step > s ? '✓' : s}</div>
                <span>{s===1?'Details':s===2?'Vehicle':'Security'}</span>
              </div>
            ))}
          </div>
        )}

        <div className="card dreg-card">

          {/* Step 1 — Personal Details */}
          {step === 1 && (
            <>
              <h2 className="dreg-title">Personal Details</h2>
              <p className="dreg-sub">Tell us about yourself</p>
              <div className="dreg-fields">
                <div className="dreg-field">
                  <label>Full Name *</label>
                  <input className="input" value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Suresh Kumar" autoFocus />
                </div>
                <div className="dreg-field">
                  <label>Phone Number *</label>
                  <input className="input" type="tel" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+91 98765 43210" />
                </div>
                <div className="dreg-field">
                  <label>Email <span className="dreg-opt">(optional)</span></label>
                  <input className="input" type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="your@email.com" />
                </div>
                <div className="dreg-field">
                  <label>Address <span className="dreg-opt">(optional)</span></label>
                  <input className="input" value={form.address} onChange={e => set('address', e.target.value)} placeholder="Your city / area" />
                </div>
                <div className="dreg-field">
                  <label>Driving License Number <span className="dreg-opt">(optional)</span></label>
                  <input className="input" value={form.licenseNumber} onChange={e => set('licenseNumber', e.target.value)} placeholder="e.g. OD0123456789012" />
                </div>
              </div>
            </>
          )}

          {/* Step 2 — Vehicle Details */}
          {step === 2 && (
            <>
              <h2 className="dreg-title">Vehicle Details</h2>
              <p className="dreg-sub">Tell us about your vehicle</p>
              <div className="dreg-fields">
                <div className="dreg-field">
                  <label>Vehicle Type *</label>
                  <div className="dreg-veh-grid">
                    {VEHICLE_TYPES.map(v => (
                      <button key={v.id}
                        className={`dreg-veh-card ${form.vehicleType === v.id ? 'selected' : ''}`}
                        onClick={() => set('vehicleType', v.id)}
                        type="button">
                        <div className="dreg-veh-label">{v.label}</div>
                        <div className="dreg-veh-desc">{v.desc}</div>
                        {form.vehicleType === v.id && <div className="dreg-veh-check">✓</div>}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="dreg-field">
                  <label>Vehicle Registration Number *</label>
                  <input className="input" value={form.vehicleNumber}
                    onChange={e => set('vehicleNumber', e.target.value.toUpperCase())}
                    placeholder="e.g. OD-05-AB-1234" style={{ textTransform: 'uppercase', letterSpacing: 1 }} />
                  <span className="dreg-hint">Enter the number plate exactly as shown on your vehicle</span>
                </div>
              </div>
            </>
          )}

          {/* Step 3 — Set PIN */}
          {step === 3 && (
            <>
              <h2 className="dreg-title">Set Your PIN</h2>
              <p className="dreg-sub">You will use this 4-digit PIN every time you sign in</p>
              <div className="dreg-fields">
                <div className="dreg-field">
                  <label>Set 4-Digit PIN *</label>
                  <input className="input" type="password" inputMode="numeric"
                    value={form.pin} onChange={e => set('pin', e.target.value.replace(/\D/g,'').slice(0,4))}
                    placeholder="Enter 4 digits" maxLength={4} autoFocus />
                </div>
                <div className="dreg-field">
                  <label>Confirm PIN *</label>
                  <input className="input" type="password" inputMode="numeric"
                    value={form.confirmPin} onChange={e => set('confirmPin', e.target.value.replace(/\D/g,'').slice(0,4))}
                    placeholder="Re-enter 4 digits" maxLength={4} />
                </div>
                <div className="dreg-summary">
                  <div className="dreg-summary-title">Registration Summary</div>
                  <div className="dreg-summary-row"><span>Name</span><span>{form.name}</span></div>
                  <div className="dreg-summary-row"><span>Phone</span><span>{form.phone}</span></div>
                  <div className="dreg-summary-row"><span>Vehicle Type</span><span>{form.vehicleType}</span></div>
                  <div className="dreg-summary-row"><span>Vehicle No.</span><span>{form.vehicleNumber}</span></div>
                </div>
              </div>
            </>
          )}

          {/* Step 4 — Success */}
          {step === 4 && result && (
            <div className="dreg-success">
              <div className="dreg-success-icon">✓</div>
              <h2 className="dreg-success-title">Registration Submitted!</h2>
              <p className="dreg-success-sub">Your application has been sent to the admin for approval.</p>
              <div className="dreg-success-id">
                <div className="dreg-success-id-label">Your Vehicle ID</div>
                <div className="dreg-success-id-val">{result.vehicleId}</div>
                <div className="dreg-success-id-hint">Save this ID. You will need it to sign in once approved.</div>
              </div>
              <div className="dreg-success-steps">
                <div>📋 Application submitted</div>
                <div>⏳ Admin reviews (24–48 hours)</div>
                <div>✅ You get approved</div>
                <div>🚗 Sign in with your Vehicle ID + PIN</div>
              </div>
              <button className="btn btn--primary btn--full btn--lg" onClick={() => navigate('/')}>
                Go to Home
              </button>
            </div>
          )}

          {/* Error */}
          {error && <p className="dreg-error">{error}</p>}

          {/* Action buttons */}
          {step < 4 && (
            <div className="dreg-actions">
              {step < 3 ? (
                <button className="btn btn--primary btn--full btn--lg" onClick={handleNext}>
                  Continue →
                </button>
              ) : (
                <button className="btn btn--primary btn--full btn--lg" onClick={handleSubmit} disabled={loading}>
                  {loading
                    ? <><span className="spinner" style={{width:16,height:16,borderWidth:2}}/>Submitting...</>
                    : 'Submit Registration'
                  }
                </button>
              )}
            </div>
          )}

        </div>

        {step === 1 && (
          <p className="dreg-already">
            Already registered?{' '}
            <button className="dreg-signin-link" onClick={() => navigate('/driver')}>Sign In</button>
          </p>
        )}

      </div>
    </div>
  );
}
