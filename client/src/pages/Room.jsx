import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useStore } from '../store';

const TEAMS = [
  'Chennai Super Kings', 'Mumbai Indians', 'Royal Challengers Bengaluru',
  'Kolkata Knight Riders', 'Delhi Capitals', 'Punjab Kings',
  'Rajasthan Royals', 'Sunrisers Hyderabad', 'Lucknow Super Giants', 'Gujarat Titans',
];

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

  // If we land here without a loaded room (e.g. refresh), ask the server.
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
      </header>

      <div className="room-body">
        <aside className="sidebar">
          <h3>Players</h3>
          <ul className="members">
            {room.memberOrder.map(uid => {
              const m = room.members[uid];
              return (
                <li key={uid} className={uid === user.id ? 'me' : ''}>
                  <strong>@{m.username}</strong>
                  {uid === room.hostId && <span className="tag">host</span>}
                  <div className="muted small">{m.team || 'no team'} · {m.squadSize}/11 · {m.connected ? '🟢' : '🔴'}</div>
                </li>
              );
            })}
          </ul>
          <Wallet priv={priv} />
          <Chat chat={chat} onSend={sendChat} text={chatText} setText={setChatText} />
        </aside>

        <section className="stage">
          {room.status === 'waiting' && <WaitingStage roomId={id} room={room} />}
          {room.status === 'preview' && <PreviewStage room={room} playersById={playersById} />}
          {room.status === 'auction' && <AuctionStage roomId={id} room={room} priv={priv} playersById={playersById} />}
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
  const myTeam = room.members[user.id]?.team;
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
            <button key={t} className={`team-btn ${mine ? 'mine' : ''} ${taken ? 'taken' : ''}`}
                    disabled={taken} onClick={() => pick(t)}>
              <div>{t}</div>
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

// ---------------- Preview ----------------
function PreviewStage({ room, playersById }) {
  const sec = useCountdown(room.previewEndsAt);
  return (
    <div>
      <h3>Player preview — auction starts in {sec ?? '…'}s</h3>
      <div className="player-preview">
        {(room.currentPlayer ? [] : [] /* preview shows pool below */)}
      </div>
      <PreviewPool room={room} playersById={playersById} />
    </div>
  );
}

function PreviewPool({ room, playersById }) {
  // pool not sent directly; show from players catalog via known pool size is fine.
  // Server's publicState includes currentPlayer but not full pool for privacy — show nothing fancy.
  return (
    <div className="muted">
      Pool of {room.poolSize} players will be auctioned. Get ready!
    </div>
  );
}

// ---------------- Auction ----------------
function AuctionStage({ roomId, room, priv, playersById }) {
  const { socket, user } = useStore();
  const sec = useCountdown(room.biddingEndsAt);
  const player = room.currentPlayer ? (playersById[room.currentPlayer.id] || room.currentPlayer) : null;
  const curAmount = room.currentBid?.amount ?? 0;
  const required = curAmount === 0 ? 20 : nextBid(curAmount);
  const leading = room.currentBid?.bidderId;
  const leaderName = leading ? room.members[leading]?.username : null;
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

  if (!player) return <div>Waiting…</div>;

  return (
    <div className="auction">
      <div className={`player-card ${leading === user.id ? 'me-leading' : ''}`}>
        <div className="ptop">
          <div className="pname">{player.name}</div>
          <div className="prating">⭐ {player.rating}</div>
        </div>
        <div className="pbid">
          <div>
            <div className="muted small">Highest bid</div>
            <div className="big">₹{curAmount}L</div>
            <div className="muted small">{leaderName ? `by @${leaderName}` : 'no bids yet'}</div>
          </div>
          <div className="timer">
            <div className="muted small">Time</div>
            <div className="big">{sec ?? '-'}s</div>
          </div>
        </div>
        <button className="bid-btn" disabled={!canBid || pending} onClick={bid}>
          {pending ? 'Pending…' : `Bid ₹${required}L`}
        </button>
        {!canBid && leading !== user.id && (
          <div className="muted small">Budget-locked or cannot bid right now</div>
        )}
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
          return <li key={pid}>{p ? `${p.name} (⭐${p.rating})` : pid}</li>;
        })}
      </ul>
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
