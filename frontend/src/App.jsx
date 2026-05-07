import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import NotifBanner    from './components/NotifBanner';
import Login          from './pages/Login';
import Home           from './pages/Home';
import BusList        from './pages/BusList';
import MapView        from './pages/MapView';
import BookRide       from './pages/BookRide';
import Driver         from './pages/Driver';
import Profile        from './pages/Profile';
import History        from './pages/History';
import Favourites     from './pages/Favourites';
import Settings       from './pages/Settings';
import Admin          from './pages/Admin';
import DriverRegister from './pages/DriverRegister';
import { Privacy, Support } from './pages/PublicPages';
import './index.css';

function ProtectedRoute({ children }) {
  const { isLoggedIn } = useAuth();
  return isLoggedIn ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <NotifBanner />
        <Routes>

          {/* ── Fully public — no login needed ── */}
          <Route path="/login"           element={<Login />} />
          <Route path="/privacy"         element={<Privacy />} />
          <Route path="/support"         element={<Support />} />
          <Route path="/admin"           element={<Admin />} />
          <Route path="/driver-register" element={<DriverRegister />} />

          {/* ── Protected — login required ── */}
          <Route path="/" element={
            <ProtectedRoute><Home /></ProtectedRoute>
          } />
          <Route path="/buses" element={
            <ProtectedRoute><BusList /></ProtectedRoute>
          } />
          <Route path="/map" element={
            <ProtectedRoute><MapView /></ProtectedRoute>
          } />
          <Route path="/book" element={
            <ProtectedRoute><BookRide /></ProtectedRoute>
          } />
          <Route path="/driver" element={
            <ProtectedRoute><Driver /></ProtectedRoute>
          } />
          <Route path="/profile" element={
            <ProtectedRoute><Profile /></ProtectedRoute>
          } />
          <Route path="/history" element={
            <ProtectedRoute><History /></ProtectedRoute>
          } />
          <Route path="/favourites" element={
            <ProtectedRoute><Favourites /></ProtectedRoute>
          } />
          <Route path="/settings" element={
            <ProtectedRoute><Settings /></ProtectedRoute>
          } />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
