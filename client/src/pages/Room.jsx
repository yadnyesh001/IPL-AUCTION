import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useStore } from '../store';

const TEAMS = [
  'Chennai Super Kings', 'Mumbai Indians', 'Royal Challengers Bengaluru',
  'Kolkata Knight Riders', 'Delhi Capitals', 'Punjab Kings',
  'Rajasthan Royals', 'Sunrisers Hyderabad', 'Lucknow Super Giants', 'Gujarat Titans',
];

// Short team codes for the oval arena badges
const TEAM_CODES = {
  'Chennai Super Kings': 'CSK',
  'Mumbai Indians': 'MI',
  'Royal Challengers Bengaluru': 'RCB',
  'Kolkata Knight Riders': 'KKR',
  'Delhi Capitals': 'DC',
  'Punjab Kings': 'PBKS',
  'Rajasthan Royals': 'RR',
  'Sunrisers Hyderabad': 'SRH',
  'Lucknow Super Giants': 'LSG',
  'Gujarat Titans': 'GT',
};

const TEAM_COLORS = {
  'Chennai Super Kings': '#f9cd05',
  'Mumbai Indians': '#004ba0',
  'Royal Challengers Bengaluru': '#da1818',
  'Kolkata Knight Riders': '#3a225d',
  'Delhi Capitals': '#17449b',
  'Punjab Kings': '#ed1b24',
  'Rajasthan Royals': '#ea1a85',
  'Sunrisers Hyderabad': '#fb643e',
  'Lucknow Super Giants': '#00a0e4',
  'Gujarat Titans': '#1b2133',
};

// Mirror of server/src/services/bidRules.js
function nextBid(cur) {
  if (cur < 20) return 20;
  if (cur < 100) return cur + 20;
  if (cur < 500) return cur + 25;
  return cur + 50;
}

function useCountdown(endsAt) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!endsAt) return;
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, [endsAt]);
  if (!endsAt) return null;
  return Math.max(0, Math.ceil((endsAt - now) / 1000));
}

export default function Room() {
  const { id } = useParams();
  const { socket, room, priv, user, playersById, chat } = useStore();
  const [chatText, setChatText] = useState('');

  useEffect(() => {
    if (!socket) return;
    if (!room || room.id !== id) socket.emit('join_room', { roomId: id }, () => {});
  }, [socket, id, room]);

  if (!room || room.id !== id) return <div className="card">Loading room {id}…</div>;

  function sendChat(e) {
    e.preventDefault();
    if (!chatText.trim()) return;
    socket.emit('chat', { roomId: id, text: chatText });
    setChatText('');
  }

  return (
    <div className="room">
      <header className="room-head">
        <h2>Room {room.id}</h2>
        <span className="pill">{room.status}</span>
        <span className="muted">{room.memberOrder.length}/{room.config.maxPlayers} players</span>
        {room.status === 'auction' || room.status === 'sold' ? (
          <span className="muted">Sold: {room.soldCount}/{room.poolSize}</span>
        ) : null}
      </header>

      <div className="room-body">
        <aside className="sidebar">
          <Wallet priv={priv} />
          <h3>Gamers</h3>
          <ul className="members">
            {room.memberOrder.map(uid => {
              const m = room.members[uid];
              const color = m.team ? TEAM_COLORS[m.team] : '#888';
              return (
                <li key={uid} className={uid === user.id ? 'me' : ''}>
                  <div className="mem-row">
                    <span className="team-dot" style={{ background: color }} />
                    <strong>@{m.username}</strong>
                    {uid === room.hostId && <span className="tag">host</span>}
                  </div>
                  <div className="muted small">
                    {m.team ? TEAM_CODES[m.team] : 'no team'} · {m.squadSize}/11 · {m.connected ? '🟢' : '🔴'}
                  </div>
                </li>
              );
            })}
          </ul>
          <Chat chat={chat} onSend={sendChat} text={chatText} setText={setChatText} />
        </aside>

        <section className="stage">
          {room.status === 'waiting' && <WaitingStage roomId={id} room={room} />}
          {room.status === 'preview' && <PreviewStage room={room} />}
          {room.status === 'auction' && <AuctionArena roomId={id} room={room} priv={priv} playersById={playersById} />}
          {room.status === 'sold' && <SoldStage room={room} playersById={playersById} />}
          {room.status === 'captain' && <CaptainStage roomId={id} room={room} priv={priv} playersById={playersById} />}
          {room.status === 'completed' && <ResultStage room={room} playersById={playersById} />}
        </section>
      </div>
    </div>
  );
}

// ---------------- Wallet ----------------
function Wallet({ priv }) {
  if (!priv) return null;
  return (
    <div className="wallet">
      <div className="muted small">Your wallet</div>
      <div className="big">₹{priv.wallet}L</div>
      <div className="muted small">Squad {priv.squad?.length || 0}/11</div>
    </div>
  );
}

// ---------------- Chat ----------------
function Chat({ chat, onSend, text, setText }) {
  return (
    <div className="chat">
      <h3>Chat</h3>
      <div className="chat-log">
        {chat.map((m, i) => (
          <div key={i}><strong>@{m.username}:</strong> {m.text}</div>
        ))}
      </div>
      <form onSubmit={onSend}>
        <input value={text} onChange={e => setText(e.target.value)} placeholder="Say something" />
      </form>
    </div>
  );
}

// ---------------- Waiting / team pick ----------------
function WaitingStage({ roomId, room }) {
  const { socket, user } = useStore();
  const takenBy = room.teams;
  const isHost = room.hostId === user.id;
  const allPicked = room.memberOrder.every(uid => !!room.members[uid].team);

  function pick(team) {
    socket.emit('pick_team', { roomId, team }, () => {});
  }
  function start() {
    socket.emit('start_auction', { roomId }, (res) => {
      if (!res.ok) alert(res.error);
    });
  }

  return (
    <div>
      <h3>Pick your team</h3>
      <div className="team-grid">
        {TEAMS.map(t => {
          const owner = takenBy[t];
          const mine = owner === user.id;
          const taken = !!owner && !mine;
          return (
            <button key={t}
                    className={`team-btn ${mine ? 'mine' : ''} ${taken ? 'taken' : ''}`}
                    style={{ borderColor: TEAM_COLORS[t] }}
                    disabled={taken} onClick={() => pick(t)}>
              <div className="team-name">{t}</div>
              <div className="small muted">{TEAM_CODES[t]}</div>
              {owner && <div className="small">@{room.members[owner]?.username}</div>}
            </button>
          );
        })}
      </div>
      <p className="muted">Share room code <code>{roomId}</code> with friends.</p>
      {isHost && (
        <button className="primary" disabled={!allPicked || room.memberOrder.length < 2} onClick={start}>
          Start auction
        </button>
      )}
    </div>
  );
}

// ---------------- Preview (full pool) ----------------
function PreviewStage({ room }) {
  const sec = useCountdown(room.previewEndsAt);
  const pool = room.playerPool || [];
  return (
    <div>
      <div className="preview-head">
        <h3>Player preview</h3>
        <span className="big accent">{sec ?? '…'}s</span>
      </div>
      <p className="muted">
        {pool.length} players are going under the hammer. Study the list — the auction order will be random.
      </p>
      <div className="pool-grid">
        {pool.map((p, i) => (
          <div key={p.id} className="pool-card">
            <div className="pool-idx">#{i + 1}</div>
            <div className="pool-name">{p.name}</div>
            <div className="pool-rating">⭐ {p.rating}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------- Auction Arena (oval) ----------------
function AuctionArena({ roomId, room, priv, playersById }) {
  const { socket, user } = useStore();
  const sec = useCountdown(room.biddingEndsAt);
  const player = room.currentPlayer ? (playersById[room.currentPlayer.id] || room.currentPlayer) : null;
  const curAmount = room.currentBid?.amount ?? 0;
  const required = curAmount === 0 ? 20 : nextBid(curAmount);
  const leading = room.currentBid?.bidderId;
  const leaderName = leading ? room.members[leading]?.username : null;
  const leaderTeam = leading ? room.members[leading]?.team : null;
  const [pending, setPending] = useState(false);

  const canBid = useMemo(() => {
    if (!priv) return false;
    if (leading === user.id) return false;
    if ((priv.squad?.length || 0) >= 11) return false;
    const slotsAfter = 11 - (priv.squad?.length || 0) - 1;
    return priv.wallet - required >= slotsAfter * 20;
  }, [priv, leading, user.id, required]);

  function bid() {
    setPending(true);
    socket.emit('new_bid', { roomId, amount: required, bidVersion: room.bidVersion }, () => {
      setPending(false);
    });
  }

  const members = room.memberOrder;
  const n = members.length;

  if (!player) return <div>Waiting…</div>;

  return (
    <div className="arena-wrap">
      <div className="arena">
        {/* Team tokens positioned around an ellipse */}
        {members.map((uid, i) => {
          const angle = (i / n) * 2 * Math.PI - Math.PI / 2;
          const rx = 44; // percent from center
          const ry = 40;
          const x = 50 + rx * Math.cos(angle);
          const y = 50 + ry * Math.sin(angle);
          const m = room.members[uid];
          const team = m.team;
          const isLeader = leading === uid;
          const isMe = user.id === uid;
          return (
            <div key={uid}
                 className={`team-token ${isLeader ? 'leading' : ''} ${isMe ? 'me' : ''} ${m.connected ? '' : 'off'}`}
                 style={{ left: `${x}%`, top: `${y}%`, '--team-color': TEAM_COLORS[team] || '#555' }}>
              <div className="tt-code">{TEAM_CODES[team] || '?'}</div>
              <div className="tt-name">@{m.username}</div>
              <div className="tt-stat">{m.squadSize}/11</div>
              {isLeader && <div className="tt-tag">LEADING</div>}
            </div>
          );
        })}

        {/* Center: current player + bid */}
        <div className={`arena-center ${leading === user.id ? 'me-leading' : ''}`}>
          <div className="ac-label small muted">NOW BIDDING</div>
          <div className="ac-name">{player.name}</div>
          <div className="ac-rating">⭐ {player.rating}</div>
          <div className="ac-bid">
            <div className="muted small">Highest bid</div>
            <div className="big accent">₹{curAmount}L</div>
            <div className="muted small">
              {leaderName
                ? <>by <strong>@{leaderName}</strong>{leaderTeam ? ` (${TEAM_CODES[leaderTeam]})` : ''}</>
                : 'no bids yet'}
            </div>
          </div>
          <div className="ac-timer">
            <div className="muted small">Time</div>
            <div className="big timer-num">{sec ?? '-'}s</div>
          </div>
          <button className="bid-btn" disabled={!canBid || pending} onClick={bid}>
            {pending ? 'Pending…' : `BID ₹${required}L`}
          </button>
          {!canBid && leading !== user.id && (
            <div className="muted small">Budget-locked or cannot bid right now</div>
          )}
        </div>
      </div>

      <SquadList priv={priv} playersById={playersById} />
    </div>
  );
}

function SquadList({ priv, playersById }) {
  if (!priv) return null;
  return (
    <div className="squad">
      <h4>Your squad ({priv.squad?.length || 0}/11)</h4>
      <ul>
        {(priv.squad || []).map(pid => {
          const p = playersById[pid];
          return <li key={pid}>{p ? `${p.name} · ⭐${p.rating}` : pid}</li>;
        })}
      </ul>
    </div>
  );
}

// ---------------- Sold ----------------
function SoldStage({ room, playersById }) {
  const sold = room.lastSold;
  const sec = useCountdown(room.nextAuctionAt);
  if (!sold) return <div className="card">Processing…</div>;
  const color = TEAM_COLORS[sold.team] || '#555';
  return (
    <div className="sold-wrap">
      <div className="sold-card" style={{ borderColor: color, boxShadow: `0 0 60px ${color}66` }}>
        <div className="sold-stamp">SOLD</div>
        <div className="sold-player">{sold.playerName}</div>
        <div className="sold-rating">⭐ {sold.playerRating}</div>
        <div className="sold-to">
          to <span className="sold-team" style={{ color }}>{TEAM_CODES[sold.team] || '—'}</span>
        </div>
        <div className="sold-user">@{sold.bidderName}</div>
        <div className="sold-amount">₹{sold.amount}L {sold.auto && <span className="muted small">(auto-assigned)</span>}</div>
        <div className="muted small">Next player in {sec ?? '…'}s</div>
      </div>
    </div>
  );
}

// ---------------- Captain pick ----------------
function CaptainStage({ roomId, room, priv, playersById }) {
  const { socket } = useStore();
  const [cap, setCap] = useState('');
  const [vc, setVc] = useState('');
  const [done, setDone] = useState(false);

  const options = (priv?.squad || []).map(pid => playersById[pid]).filter(Boolean);

  function save() {
    if (!cap) return alert('Pick a captain');
    if (cap === vc) return alert('VC must differ');
    socket.emit('pick_captains', { roomId, captain: cap, viceCaptain: vc || null }, (res) => {
      if (res.ok) setDone(true); else alert(res.error);
    });
  }

  return (
    <div className="card">
      <h3>Pick Captain & Vice Captain</h3>
      <p className="muted">Captain scores 2× rating, Vice Captain scores 1.5×.</p>
      <label>Captain
        <select value={cap} onChange={e => setCap(e.target.value)}>
          <option value="">—</option>
          {options.map(p => <option key={p.id} value={p.id}>{p.name} (⭐{p.rating})</option>)}
        </select>
      </label>
      <label>Vice Captain
        <select value={vc} onChange={e => setVc(e.target.value)}>
          <option value="">—</option>
          {options.filter(p => p.id !== cap).map(p => <option key={p.id} value={p.id}>{p.name} (⭐{p.rating})</option>)}
        </select>
      </label>
      <button disabled={done} onClick={save}>{done ? 'Locked in ✓' : 'Confirm'}</button>
      <p className="muted small">Auto-assign if not submitted in time.</p>
    </div>
  );
}

// ---------------- Result ----------------
function ResultStage({ room, playersById }) {
  const lb = useStore(s => s.leaderboard);
  if (!lb || !lb.length) return <div className="card">Finalizing results…</div>;
  return (
    <div className="card">
      <h2>🏆 Leaderboard</h2>
      <ol className="leaderboard">
        {lb.map((r, i) => (
          <li key={r.userId}>
            <div className="lb-head">
              <span className="rank">#{i + 1}</span>
              <strong>@{r.username}</strong>
              <span className="muted">{r.team}</span>
              <span className="points">{r.totalPoints} pts</span>
            </div>
            <div className="muted small">
              Captain: {playersById[r.captain]?.name || '—'} ·
              VC: {playersById[r.viceCaptain]?.name || '—'} ·
              Squad Σ: {r.sumRating} ·
              Wallet left: ₹{r.remainingBudget}L
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
