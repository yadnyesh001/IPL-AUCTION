import React, { useEffect, useMemo, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useStore } from '../store';
import PlayerAvatar, { avatarStyle } from '../components/PlayerAvatar.jsx';

const TEAMS = [
  'Chennai Super Kings', 'Mumbai Indians', 'Royal Challengers Bengaluru',
  'Kolkata Knight Riders', 'Delhi Capitals', 'Punjab Kings',
  'Rajasthan Royals', 'Sunrisers Hyderabad', 'Lucknow Super Giants', 'Gujarat Titans',
];

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

// Local bid history, built from room.currentBid transitions.
function useBidHistory(room, playersById) {
  const [feed, setFeed] = useState([]); // {ts, text}
  const lastKeyRef = useRef(null);
  useEffect(() => {
    if (!room) return;
    const cp = room.currentPlayer;
    const cb = room.currentBid;
    if (cp && cb) {
      const key = `${cp.id}|${cb.bidderId}|${cb.amount}`;
      if (key !== lastKeyRef.current) {
        lastKeyRef.current = key;
        const bidder = room.members[cb.bidderId];
        setFeed(prev => [
          { ts: Date.now(), text: `@${bidder?.username || '?'} bids ₹${cb.amount}L for ${playersById[cp.id]?.name || cp.name}` },
          ...prev,
        ].slice(0, 30));
      }
    }
    if (room.lastSold) {
      const key = `SOLD|${room.lastSold.playerId}|${room.lastSold.bidderId}|${room.lastSold.amount}`;
      if (key !== lastKeyRef.current) {
        lastKeyRef.current = key;
        setFeed(prev => [
          { ts: Date.now(), text: `SOLD: ${room.lastSold.playerName} → @${room.lastSold.bidderName} @ ₹${room.lastSold.amount}L` , sold: true},
          ...prev,
        ].slice(0, 30));
      }
    }
  }, [room?.currentBid?.amount, room?.currentBid?.bidderId, room?.currentPlayer?.id, room?.lastSold?.playerId, playersById]);
  return feed;
}

export default function Room() {
  const { id } = useParams();
  const nav = useNavigate();
  const { socket, room, priv, user, playersById, chat } = useStore();
  const [chatText, setChatText] = useState('');
  const [leaving, setLeaving] = useState(false);
  const feed = useBidHistory(room, playersById);

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

  function onLeaveGame() {
    const inGame = room.status === 'auction' || room.status === 'sold' || room.status === 'preview';
    const msg = inGame
      ? 'Leave the game?\n\nYour seat stays in the auction and players will be auto-assigned to you. You will not be able to rejoin this room.'
      : 'Leave this room?';
    if (!window.confirm(msg)) return;
    socket.emit('abandon_room', { roomId: id }, () => {
      setLeaving(true);
      nav('/');
    });
  }

  const myMember = room.members[user.id];
  const iAbandoned = myMember?.abandoned;

  return (
    <div className="room">
      <header className="room-head">
        <div className="rh-left">
          <div className="rh-code">
            <span className="muted small">ROOM</span>
            <span className="rh-id">{room.id}</span>
          </div>
          <span className={`pill status-${room.status}`}>{room.status}</span>
        </div>
        <div className="rh-right">
          <span className="muted small">{room.memberOrder.length}/{room.config.maxPlayers} gamers</span>
          {(room.status === 'auction' || room.status === 'sold') && (
            <span className="muted small">· {room.soldCount}/{room.poolSize} sold</span>
          )}
          {!iAbandoned && room.status !== 'completed' && (
            <button className="ghost danger" onClick={onLeaveGame} disabled={leaving}>
              Leave game
            </button>
          )}
        </div>
      </header>

      {iAbandoned && (
        <div className="banner warn">
          You left this game. Auto-bids are still running for your seat. You can't rejoin — start a new room from the lobby.
        </div>
      )}

      <div className="room-body">
        <aside className="sidebar">
          <Wallet priv={priv} />
          <h3>Gamers</h3>
          <ul className="members">
            {room.memberOrder.map(uid => {
              const m = room.members[uid];
              const color = m.team ? TEAM_COLORS[m.team] : '#888';
              return (
                <li key={uid} className={`${uid === user.id ? 'me' : ''} ${m.abandoned ? 'gone' : ''}`}>
                  <div className="mem-row">
                    <span className="team-dot" style={{ background: color }} />
                    <strong>@{m.username}</strong>
                    {uid === room.hostId && <span className="tag">host</span>}
                    {m.abandoned && <span className="tag warn">left</span>}
                  </div>
                  <div className="muted small">
                    {m.team ? TEAM_CODES[m.team] : 'no team'} · {m.squadSize}/11 · {m.connected ? '🟢' : '🔴'}
                  </div>
                </li>
              );
            })}
          </ul>
          {(room.status === 'auction' || room.status === 'sold') && (
            <BidFeed feed={feed} />
          )}
          <Chat chat={chat} onSend={sendChat} text={chatText} setText={setChatText} />
        </aside>

        <section className="stage">
          {room.status === 'waiting' && <WaitingStage roomId={id} room={room} />}
          {room.status === 'preview' && <PreviewStage room={room} playersById={playersById} />}
          {room.status === 'auction' && <AuctionArena roomId={id} room={room} priv={priv} playersById={playersById} />}
          {room.status === 'sold' && <SoldStage room={room} playersById={playersById} />}
          {room.status === 'completed' && <ResultStage room={room} />}
        </section>
      </div>
    </div>
  );
}

// ---------------- Wallet ----------------
function Wallet({ priv }) {
  if (!priv) return null;
  const pct = Math.min(100, Math.round((priv.wallet / 5000) * 100));
  return (
    <div className="wallet">
      <div className="muted small">Your wallet</div>
      <div className="big accent">₹{priv.wallet}L</div>
      <div className="wallet-bar">
        <div className="wallet-bar-fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="muted small">Squad {priv.squad?.length || 0}/11</div>
    </div>
  );
}

// ---------------- Bid feed ----------------
function BidFeed({ feed }) {
  return (
    <div className="bid-feed">
      <h3>Bid history</h3>
      <div className="bid-feed-log">
        {feed.length === 0
          ? <div className="muted small">Waiting for first bid…</div>
          : feed.map((m, i) => (
              <div key={m.ts + ':' + i} className={`bid-feed-row ${m.sold ? 'sold' : ''}`}>
                {m.text}
              </div>
            ))}
      </div>
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

// ---------------- Preview (full pool with avatars) ----------------
function PreviewStage({ room, playersById }) {
  const sec = useCountdown(room.previewEndsAt);
  const pool = room.playerPool || [];
  return (
    <div>
      <div className="preview-head">
        <div>
          <h3 style={{ margin: 0 }}>Player preview</h3>
          <div className="muted small">{pool.length} players · random order</div>
        </div>
        <div className="preview-timer">
          <div className="muted small">Starts in</div>
          <div className="big accent">{sec ?? '…'}s</div>
        </div>
      </div>
      <div className="pool-grid">
        {pool.map((p, i) => {
          const full = playersById[p.id] || p;
          return (
            <div key={p.id} className="pool-card">
              <div className="pool-idx">#{i + 1}</div>
              <PlayerAvatar name={full.name} size={44} />
              <div className="pool-meta">
                <div className="pool-name">{full.name}</div>
                <div className="pool-rating">⭐ {full.rating}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------- Oval Auction Arena ----------------
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

  // Flash the bid number briefly when it changes
  const [flashKey, setFlashKey] = useState(0);
  const prevBidRef = useRef(curAmount);
  useEffect(() => {
    if (prevBidRef.current !== curAmount) {
      prevBidRef.current = curAmount;
      setFlashKey(k => k + 1);
    }
  }, [curAmount]);

  const iAmInRoom = !!priv && !room.members[user.id]?.abandoned;

  const canBid = useMemo(() => {
    if (!iAmInRoom) return false;
    if (leading === user.id) return false;
    if ((priv.squad?.length || 0) >= 11) return false;
    const slotsAfter = 11 - (priv.squad?.length || 0) - 1;
    return priv.wallet - required >= slotsAfter * 20;
  }, [priv, leading, user.id, required, iAmInRoom]);

  function bid() {
    setPending(true);
    socket.emit('new_bid', { roomId, amount: required, bidVersion: room.bidVersion }, () => {
      setPending(false);
    });
  }

  const members = room.memberOrder;
  const n = members.length;

  if (!player) return <div>Waiting…</div>;

  const playerColor = TEAM_COLORS[leaderTeam] || '#f5a623';

  return (
    <div className="arena-wrap">
      <div className="arena">
        {/* Team tokens around the oval */}
        {members.map((uid, i) => {
          const angle = (i / n) * 2 * Math.PI - Math.PI / 2;
          const rx = 44;
          const ry = 40;
          const x = 50 + rx * Math.cos(angle);
          const y = 50 + ry * Math.sin(angle);
          const m = room.members[uid];
          const team = m.team;
          const isLeader = leading === uid;
          const isMe = user.id === uid;
          return (
            <div key={uid}
                 className={`team-token ${isLeader ? 'leading' : ''} ${isMe ? 'me' : ''} ${m.connected ? '' : 'off'} ${m.abandoned ? 'gone' : ''}`}
                 style={{ left: `${x}%`, top: `${y}%`, '--team-color': TEAM_COLORS[team] || '#555' }}>
              <div className="tt-code">{TEAM_CODES[team] || '?'}</div>
              <div className="tt-name">@{m.username}</div>
              <div className="tt-stat">{m.squadSize}/11 · ₹{/* wallet not public */}</div>
              {isLeader && <div className="tt-tag leading-tag">LEADING</div>}
              {m.abandoned && <div className="tt-tag gone-tag">LEFT</div>}
            </div>
          );
        })}

        {/* Center card */}
        <div className={`arena-center ${leading === user.id ? 'me-leading' : ''}`}>
          <div className="ac-top">
            <PlayerAvatar name={player.name} size={72} className="ac-avatar" />
            <div>
              <div className="ac-label small muted">NOW BIDDING</div>
              <div className="ac-name">{player.name}</div>
              <div className="ac-rating">⭐ {player.rating}</div>
            </div>
          </div>

          <div className="ac-bid-row">
            <div className="ac-bid-col">
              <div className="muted small">HIGHEST BID</div>
              <div key={flashKey} className="ac-bid-amount">₹{curAmount}L</div>
              <div className="ac-bid-leader">
                {leaderName
                  ? <>by <strong style={{ color: playerColor }}>@{leaderName}</strong>{leaderTeam ? ` · ${TEAM_CODES[leaderTeam]}` : ''}</>
                  : <span className="muted small">No bids yet</span>}
              </div>
            </div>
            <div className="ac-timer-col">
              <svg className="timer-ring" viewBox="0 0 60 60">
                <circle cx="30" cy="30" r="26" className="ring-bg" />
                <circle cx="30" cy="30" r="26" className="ring-fg"
                        style={{ strokeDashoffset: 163 - 163 * Math.min(1, (sec ?? 0) / 20) }} />
              </svg>
              <div className="timer-text">{sec ?? '-'}</div>
            </div>
          </div>

          <button className="bid-btn" disabled={!canBid || pending} onClick={bid}>
            {pending ? 'Pending…' : `BID ₹${required}L`}
          </button>
          {!canBid && leading !== user.id && (
            <div className="muted small" style={{ marginTop: 8 }}>
              {room.members[user.id]?.abandoned ? 'You left this game' : 'Budget-locked or cannot bid right now'}
            </div>
          )}
        </div>
      </div>

      <SquadList priv={priv} playersById={playersById} />
    </div>
  );
}

function SquadList({ priv, playersById }) {
  if (!priv) return null;
  const squad = (priv.squad || []).map(pid => playersById[pid]).filter(Boolean);
  return (
    <div className="squad">
      <h4>Your squad ({squad.length}/11)</h4>
      <ul>
        {squad.map(p => (
          <li key={p.id} className="squad-row">
            <PlayerAvatar name={p.name} size={28} />
            <span className="squad-name">{p.name}</span>
            <span className="squad-rating">⭐{p.rating}</span>
          </li>
        ))}
        {squad.length === 0 && <li className="muted small">No players bought yet</li>}
      </ul>
    </div>
  );
}

// ---------------- Sold ----------------
function SoldStage({ room, playersById }) {
  const sold = room.lastSold;
  const sec = useCountdown(room.nextAuctionAt);
  if (!sold) return <div className="card">Processing…</div>;
  const color = TEAM_COLORS[sold.team] || '#2ecc71';
  const full = playersById[sold.playerId];
  return (
    <div className="sold-wrap">
      <div className="sold-card" style={{ borderColor: color, boxShadow: `0 0 60px ${color}66` }}>
        <div className="sold-stamp">SOLD</div>
        <PlayerAvatar name={sold.playerName} size={92} className="sold-avatar" />
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

// ---------------- Result ----------------
function ResultStage({ room }) {
  const lb = useStore(s => s.leaderboard);
  if (!lb || !lb.length) return <div className="card">Finalizing results…</div>;
  return (
    <div className="card">
      <h2>🏆 Leaderboard</h2>
      <ol className="leaderboard">
        {lb.map((r, i) => (
          <li key={r.userId} className={`lb-item rank-${i + 1}`}>
            <div className="lb-head">
              <span className="rank">#{i + 1}</span>
              <div className="lb-who">
                <strong>@{r.username}</strong>
                <div className="muted small">{TEAM_CODES[r.team] || r.team || '—'}</div>
              </div>
              <div className="lb-pts">
                <div className="points">{r.totalPoints}</div>
                <div className="muted small">points</div>
              </div>
            </div>
            <div className="muted small lb-stats">
              {r.squad.length} players · ₹{r.remainingBudget}L left
            </div>
            <details className="lb-squad">
              <summary>View squad</summary>
              <ul className="lb-squad-list">
                {r.squad
                  .slice()
                  .sort((a, b) => b.rating - a.rating)
                  .map(p => (
                    <li key={p.id}>
                      <PlayerAvatar name={p.name} size={24} />
                      <span>{p.name}</span>
                      <span className="muted">⭐{p.rating}</span>
                    </li>
                  ))}
              </ul>
            </details>
          </li>
        ))}
      </ol>
    </div>
  );
}
