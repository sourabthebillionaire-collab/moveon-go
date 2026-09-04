import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import api from '../services/api';
import './Login.css';

export default function Login() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { login, isLoggedIn } = useAuth();

  const [isRegistering, setIsRegistering] = useState(false);
  const [name,     setName]     = useState('');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  const from = location.state?.from || '/';

  useEffect(() => {
    if (isLoggedIn) navigate(from, { replace: true });
  }, [isLoggedIn, navigate, from]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!email.trim() || !password.trim()) {
      setError('Please fill in both email and password.');
      return;
    }

    if (isRegistering && !name.trim()) {
      setError('Please provide your name.');
      return;
    }

    setLoading(true);

    try {
      let data;
      if (isRegistering) {
        data = await api.register(name.trim(), email.trim(), password);
      } else {
        data = await api.login(email.trim(), password);
      }
      
      if (!data.token) {
        setError(data.message || 'Authentication failed. Please try again.');
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
          <h2 className="login-title">{isRegistering ? 'Create Account' : 'Welcome Back'}</h2>
          <p className="login-sub">
            {isRegistering ? 'Sign up to get started' : 'Log in to your account'}
          </p>

          <form onSubmit={handleSubmit} className="login-form">

            {isRegistering && (
              <div className="login-field">
                <label className="login-label">Full Name</label>
                <input
                  className="input"
                  type="text"
                  value={name}
                  onChange={e => { setName(e.target.value); setError(''); }}
                  placeholder="e.g. John Doe"
                  autoComplete="name"
                  disabled={loading}
                />
              </div>
            )}

            <div className="login-field">
              <label className="login-label">Email Address</label>
              <input
                className="input"
                type="email"
                value={email}
                onChange={e => { setEmail(e.target.value); setError(''); }}
                placeholder="you@example.com"
                autoComplete="email"
                disabled={loading}
              />
            </div>

            <div className="login-field">
              <label className="login-label">Password</label>
              <input
                className="input"
                type="password"
                value={password}
                onChange={e => { setPassword(e.target.value); setError(''); }}
                placeholder="••••••••"
                autoComplete={isRegistering ? 'new-password' : 'current-password'}
                disabled={loading}
              />
            </div>

            {error && <p className="login-error">{error}</p>}

            <button
              className="btn btn--primary btn--full btn--lg"
              type="submit"
              disabled={loading || !email.trim() || !password.trim()}
              style={{ marginTop: 12 }}
            >
              {loading
                ? <><span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> {isRegistering ? 'Signing up...' : 'Logging in...'}</>
                : (isRegistering ? 'Sign Up →' : 'Log In →')
              }
            </button>

          </form>

          <p className="login-info" style={{ marginTop: 20 }}>
            {isRegistering ? 'Already have an account?' : "Don't have an account?"}
            <button 
              type="button" 
              onClick={() => { setIsRegistering(!isRegistering); setError(''); }}
              style={{ background: 'none', border: 'none', color: 'var(--blue-600)', fontWeight: 600, cursor: 'pointer', marginLeft: 8 }}
            >
              {isRegistering ? 'Log In' : 'Sign Up'}
            </button>
          </p>
        </div>

        <p className="login-terms">
          By continuing you agree to our <a href="/privacy">Terms & Privacy Policy</a>
        </p>

      </div>
    </div>
  );
}
