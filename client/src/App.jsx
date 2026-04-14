import React, { useEffect } from 'react';
import { Routes, Route, Navigate, Link, useNavigate } from 'react-router-dom';
import { useStore } from './store';
import { api } from './api';
import Login from './pages/Login.jsx';
import Lobby from './pages/Lobby.jsx';
import Room from './pages/Room.jsx';

function NavBar() {
  const { user, logout, toast } = useStore();
  const nav = useNavigate();
  return (
    <>
      <nav className="nav">
        <Link to="/" className="brand">🏏 IPL Auction</Link>
        <div className="spacer" />
        {user ? (
          <>
            <span className="muted">@{user.username}</span>
            <button className="ghost" onClick={() => { logout(); nav('/login'); }}>Logout</button>
          </>
        ) : (
          <Link to="/login" className="ghost">Login</Link>
        )}
      </nav>
      {toast && <div className="toast">{toast}</div>}
    </>
  );
}

function RequireAuth({ children }) {
  const { token } = useStore();
  if (!token) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  const { token, connectSocket, setPlayers } = useStore();

  useEffect(() => {
    api.players().then(r => setPlayers(r.players)).catch(() => {});
  }, [setPlayers]);

  useEffect(() => {
    if (token) connectSocket();
  }, [token, connectSocket]);

  return (
    <div className="app">
      <NavBar />
      <main>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<RequireAuth><Lobby /></RequireAuth>} />
          <Route path="/room/:id" element={<RequireAuth><Room /></RequireAuth>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
