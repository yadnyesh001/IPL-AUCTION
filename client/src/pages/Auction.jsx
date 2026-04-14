import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getSocket } from '../socket.js';

function fmt(lakhs) {
  if (lakhs >= 100) return `₹${(lakhs / 100).toFixed(2)} Cr`;
  return `₹${lakhs} L`;
}

export default function Auction() {
  const { code } = useParams();
  const nav = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  const [phase, setPhase] = useState('loading'); // preview | live | captains
  const [pool, setPool] = useState([]);
  const [previewLeftMs, setPreviewLeftMs] = useState(0);
  const [current, setCurrent] = useState(null); // {player, index, total, minBid}
  const [bid, setBid] = useState(0);
  const [leader, setLeader] = useState(null);
  const [nextMin, setNextMin] = useState(20);
  const [endsAt, setEndsAt] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [wallet, setWallet] = useState(5000);
  const [squad, setSquad] = useState([]);
  const [sold, setSold] = useState([]);
  const [err, setErr] = useState('');
  const [pending, setPending] = useState(false);
  const [chat, setChat] = useState([]);
  const [msg, setMsg] = useState('');
  const [capSel, setCapSel] = useState('');
  const [vcSel, setVcSel] = useState('');
  const tickRef = useRef(null);

  useEffect(() => {
    const s = getSocket();
    // tell server we are (still) in the room (for refresh)
    s.emit('join_room', { code });

    const onPreview = ({ pool, durationMs }) => {
      setPhase('preview');
      setPool(pool);
      setPreviewLeftMs(durationMs);
    };
    const onStart = () => setPhase('live');
    const onUp = (d) => {
      setCurrent(d);
      setBid(0);
      setLeader(null);
      setNextMin(d.minBid);
      setPending(false);
      setErr('');
    };
    const onBidOk = ({ amount, leaderUserId, leaderUsername, nextMin }) => {
      setBid(amount);
      setLeader({ id: leaderUserId, name: leaderUsername });
      setNextMin(nextMin);
      setPending(false);
    };
    const onBidNo = ({ reason }) => {
      setErr(reason);
      setPending(false);
    };
    const onTimer = ({ endsAt }) => setEndsAt(endsAt);
    const onSold = (d) => {
      setSold((p) => [d, ...p].slice(0, 20));
      if (d.winnerUserId === user.id) {
        setSquad((p) => [...p, { pid: d.pid, name: d.name, price: d.price }]);
      }
    };
    const onWallet = ({ userId, budget, squadSize }) => {
      if (userId === user.id) setWallet(budget);
    };
    const onComplete = () => setPhase('captains');
    const onBoard = () => nav(`/room/${code}/result`);
    const onChat = (m) => setChat((c) => [...c.slice(-50), m]);
    const onErr = (e) => setErr(e.msg || '');

    s.on('preview_start', onPreview);
    s.on('auction_started', onStart);
    s.on('player_up', onUp);
    s.on('bid_accepted', onBidOk);
    s.on('bid_rejected', onBidNo);
    s.on('timer_update', onTimer);
    s.on('player_sold', onSold);
    s.on('wallet_update', onWallet);
    s.on('auction_complete', onComplete);
    s.on('leaderboard', onBoard);
    s.on('chat_msg', onChat);
    s.on('error', onErr);

    tickRef.current = setInterval(() => setNow(Date.now()), 200);
    return () => {
      clearInterval(tickRef.current);
      s.off('preview_start', onPreview);
      s.off('auction_started', onStart);
      s.off('player_up', onUp);
      s.off('bid_accepted', onBidOk);
      s.off('bid_rejected', onBidNo);
      s.off('timer_update', onTimer);
      s.off('player_sold', onSold);
      s.off('wallet_update', onWallet);
      s.off('auction_complete', onComplete);
      s.off('leaderboard', onBoard);
      s.off('chat_msg', onChat);
      s.off('error', onErr);
    };
  }, [code, nav, user.id]);

  // preview countdown
  useEffect(() => {
    if (phase !== 'preview') return;
    if (previewLeftMs <= 0) return;
    const t = setInterval(() => setPreviewLeftMs((ms) => Math.max(0, ms - 200)), 200);
    return () => clearInterval(t);
  }, [phase, previewLeftMs]);

  function placeBid() {
    if (!current) return;
    setPending(true);
    setErr('');
    getSocket().emit('new_bid', { code, pid: current.player.pid, amount: nextMin });
  }

  function sendChat(e) {
    e.preventDefault();
    if (!msg.trim()) return;
    getSocket().emit('chat_msg', { code, text: msg.trim() });
    setMsg('');
  }

  function saveCaptains() {
    if (!capSel || !vcSel || capSel === vcSel) {
      setErr('Pick distinct C and VC');
      return;
    }
    getSocket().emit('select_captain', { code, captainPid: capSel, viceCaptainPid: vcSel });
  }

  if (phase === 'loading') return <div className="center"><div className="card">Loading…</div></div>;

  if (phase === 'preview') {
    return (
      <div className="center">
        <div className="card wide">
          <h1>Player Preview</h1>
          <div className="muted">Auction starts in {Math.ceil(previewLeftMs / 1000)}s</div>
          <div className="pool">
            {pool.map((p) => (
              <div className="pp" key={p.pid}>
                <div className="pn">{p.name}</div>
                <div className="pr">{p.rating.toFixed(1)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'captains') {
    return (
      <div className="center">
        <div className="card wide">
          <h1>Pick Captain & Vice-Captain</h1>
          <div className="muted">Auto-assigned in 30s if you skip.</div>
          <div>
            <h3>Captain (2× rating)</h3>
            <select value={capSel} onChange={(e) => setCapSel(e.target.value)}>
              <option value="">—</option>
              {squad.map((p) => <option key={p.pid} value={p.pid}>{p.name}</option>)}
            </select>
            <h3>Vice-Captain (1.5× rating)</h3>
            <select value={vcSel} onChange={(e) => setVcSel(e.target.value)}>
              <option value="">—</option>
              {squad.map((p) => <option key={p.pid} value={p.pid}>{p.name}</option>)}
            </select>
          </div>
          <button className="primary" onClick={saveCaptains}>Save</button>
          {err && <div className="err">{err}</div>}
        </div>
      </div>
    );
  }

  // live
  const leftMs = Math.max(0, endsAt - now);
  const pct = endsAt ? Math.min(100, (leftMs / (10 * 1000)) * 100) : 0;
  const iAmLeader = leader?.id === user.id;

  return (
    <div className="center">
      <div className="card wide">
        <div className="row spread">
          <h1>Room {code}</h1>
          <div className="muted">Wallet: <b>{fmt(wallet)}</b> · Squad {squad.length}/11</div>
        </div>

        {current && (
          <div className="auction">
            <div className="player-card">
              <div className="pn big">{current.player.name}</div>
              <div className="pr big">Rating {current.player.rating.toFixed(1)}</div>
              <div className="muted">Player {current.index + 1} / {current.total}</div>
            </div>
            <div className="bid-info">
              <div className="current-bid">Highest: <b>{bid ? fmt(bid) : '—'}</b></div>
              <div className={`leader ${iAmLeader ? 'me' : ''}`}>
                {leader ? (iAmLeader ? 'You are leading' : `Led by ${leader.name}`) : 'No bids yet'}
              </div>
              <div className="timer">
                <div className="bar" style={{ width: `${pct}%` }} />
                <span>{Math.ceil(leftMs / 1000)}s</span>
              </div>
              <button
                className="primary"
                disabled={pending || iAmLeader}
                onClick={placeBid}
              >
                {pending ? 'Pending…' : `Bid ${fmt(nextMin)}`}
              </button>
              {err && <div className="err">{err}</div>}
            </div>
          </div>
        )}

        <div className="cols">
          <div>
            <h3>My Squad</h3>
            <ul className="squad">
              {squad.map((p) => (
                <li key={p.pid}>{p.name} <span className="muted">{fmt(p.price)}</span></li>
              ))}
            </ul>
          </div>
          <div>
            <h3>Recently sold</h3>
            <ul className="squad">
              {sold.map((s, i) => (
                <li key={i}>
                  {s.name} → <b>{s.winnerUsername}</b> {fmt(s.price)} {s.auto && <span className="badge">AUTO</span>}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <h3>Chat</h3>
        <div className="chat">
          {chat.map((m, i) => <div key={i}><b>{m.from}:</b> {m.text}</div>)}
        </div>
        <form onSubmit={sendChat} className="row">
          <input value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="message…" />
          <button type="submit">Send</button>
        </form>
      </div>
    </div>
  );
}
