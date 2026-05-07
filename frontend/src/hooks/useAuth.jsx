import { createContext, useContext, useState, useEffect } from 'react';
import { getUser, getToken, setSession, clearSession } from '../services/storage';

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user,  setUser]  = useState(() => getUser());
  const [token, setToken] = useState(() => getToken());

  const login = (u, tok) => {
    setSession(u, tok);
    setUser(u); setToken(tok);
  };

  const logout = () => {
    clearSession();
    setUser(null); setToken(null);
  };

  return (
    <AuthCtx.Provider value={{ user, token, login, logout, isLoggedIn: !!token }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() { return useContext(AuthCtx); }
