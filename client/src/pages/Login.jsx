import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useStore } from '../store';

export default function Login() {
  const [mode, setMode] = useState('login');
  const [username, setU] = useState('');
  const [password, setP] = useState('');
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const setAuth = useStore(s => s.setAuth);
  const nav = useNavigate();

  async function submit(e) {
    e.preventDefault();
    setErr(null); setBusy(true);
    try {
      const fn = mode === 'login' ? api.login : api.register;
      const res = await fn(username, password);
      setAuth(res);
      nav('/');
    } catch (e) {
      setErr(e.message);
    } finally { setBusy(false); }
  }

  return (
    <div className="card center">
      <h1>{mode === 'login' ? 'Login' : 'Register'}</h1>
      <form onSubmit={submit}>
        <label>Username
          <input value={username} onChange={e => setU(e.target.value)} autoFocus required />
        </label>
        <label>Password
          <input type="password" value={password} onChange={e => setP(e.target.value)} required />
        </label>
        {err && <div className="error">{err}</div>}
        <button disabled={busy}>{busy ? '...' : (mode === 'login' ? 'Login' : 'Create account')}</button>
      </form>
      <p className="muted">
        {mode === 'login' ? 'No account?' : 'Have an account?'}{' '}
        <a href="#" onClick={e => { e.preventDefault(); setMode(mode === 'login' ? 'register' : 'login'); }}>
          {mode === 'login' ? 'Register' : 'Login'}
        </a>
      </p>
    </div>
  );
}
