import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import api from '../services/api';
import './Login.css';
export default function Login() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { login, isLoggedIn } = useAuth();

  const [phone,   setPhone]   = useState('');
  const [name,    setName]    = useState('');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  const from = location.state?.from || '/';

  useEffect(() => {
    if (isLoggedIn) navigate(from, { replace: true });
  }, [isLoggedIn]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');

    const cleanPhone = phone.trim().replace(/[^0-9+]/g, ''); // Ensure consistent phone number format
    if (!cleanPhone) {
      setError('Please enter your phone number.');
      return;
    }
    if (cleanPhone.replace(/\D/g, '').length < 10) {
      setError('Please enter a valid 10-digit phone number.');
      return;
    }

    setLoading(true);
    try {
      const data = await api.login(cleanPhone, name.trim());
      if (!data.token) {
        setError(data.message || 'Login failed. Please try again.');
        return;
      }

      login(data.user, data.token);
      navigate(from, { replace: true });

    } catch (err) {
      setError(err.message || 'Service unreachable. Please check your internet connection.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page" style={{background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)'}}>
      <div className="login-container">

        {/* Brand */}
        <div className="login-brand">
          <img
            src="/logo.svg"
            alt="MoveOn Go"
            className="login-logo"
            onError={e => { e.target.style.display = 'none'; }}
          />
          <h1 className="login-brand-name">MoveOn<span>Go</span></h1>
        </div>

        {/* Card */}
        <div className="login-card card">
          <h2 className="login-title">Welcome</h2>
          <p className="login-sub">Enter your phone number to continue</p>

          <form onSubmit={handleLogin} className="login-form">

            <div className="login-field">
              <label className="login-label">Phone Number</label>
              <input
                className="input"
                type="tel"
                value={phone}
                onChange={e => { setPhone(e.target.value); setError(''); }}
                placeholder="+91 98765 43210"
                autoFocus
                autoComplete="tel"
                disabled={loading}
                maxLength={15}
              />
            </div>

            <div className="login-field">
              <label className="login-label">Your Name <span style={{ color: 'var(--gray-400)', fontWeight: 400 }}>(optional)</span></label>
              <input
                className="input"
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Sarub Bacha"
                autoComplete="name"
                disabled={loading}
              />
            </div>

            {error && <p className="login-error">{error}</p>}

            <button
              className="btn btn--primary btn--full btn--lg"
              type="submit"
              disabled={loading || !phone.trim()}
              style={{ marginTop: 4 }}
            >
              {loading
                ? <><span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Signing in...</>
                : 'Continue →'
              }
            </button>

          </form>

          <p className="login-info">
            No OTP needed. Your number will be saved securely.
          </p>
        </div>

        <p className="login-terms">
          By continuing you agree to our <a href="/privacy">Terms & Privacy Policy</a>
        </p>

      </div>
    </div>
  );
}
