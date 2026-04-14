// Auction engine — server is the single source of truth.
//
// State shape per room:
// {
//   id, hostId, status: 'waiting'|'preview'|'auction'|'captain'|'completed',
//   config: { timerSec, maxPlayers },
//   members: { [userId]: { username, team, wallet, squad:[playerId], connected, disconnectedAt } },
//   memberOrder: [userId],
//   teams: { [teamName]: userId },              // team locks
//   playerPool: [playerObj],                    // shuffled pool, length = members*11
//   currentIdx: number,
//   currentBid: { amount, bidderId } | null,
//   bidVersion: number,                         // monotonic, used to reject stale bids
//   previewEndsAt, biddingEndsAt,
//   soldLog: [{ playerId, bidderId, amount }],
//   chat: [{ userId, username, text, ts }],
//   captains: { [userId]: { captain, viceCaptain } },
//   _timer: Timeout (not serialized)
// }

const { nanoid } = require('../utils/ids');
const PLAYERS = require('../data/players');
const { secureShuffle } = require('../utils/shuffle');
const { BUDGET, BASE_PRICE, SQUAD_SIZE, nextBid, canAfford, maxBid } = require('./bidRules');
const { getRoom, setRoom, deleteRoom, saveSnapshot } = require('./gameState');
const log = require('../utils/logger');

const TEAMS = [
  'Chennai Super Kings', 'Mumbai Indians', 'Royal Challengers Bengaluru',
  'Kolkata Knight Riders', 'Delhi Capitals', 'Punjab Kings',
  'Rajasthan Royals', 'Sunrisers Hyderabad', 'Lucknow Super Giants', 'Gujarat Titans',
];

const PREVIEW_MS = 60 * 1000;
const GRACE_MS = 30 * 1000;
const INITIAL_BID_MS = 20 * 1000;   // timer when a new player comes up
const SOLD_PAUSE_MS = 10 * 1000;    // pause showing "sold to X" before next player

// io reference, injected on init
let io = null;
function init(ioRef) { io = ioRef; }

// ---------- room helpers ----------

function publicState(room) {
  // what clients receive; wallets are private elsewhere
  return {
    id: room.id,
    hostId: room.hostId,
    status: room.status,
    config: room.config,
    members: Object.fromEntries(
      Object.entries(room.members).map(([uid, m]) => [uid, {
        username: m.username,
        team: m.team,
        squadSize: m.squad.length,
        connected: m.connected,
      }])
    ),
    memberOrder: room.memberOrder,
    teams: room.teams,
    playerPool: room.playerPool || null,   // expose whole pool for preview
    currentIdx: room.currentIdx,
    currentPlayer: room.playerPool && room.currentIdx != null ? room.playerPool[room.currentIdx] : null,
    currentBid: room.currentBid,
    bidVersion: room.bidVersion,
    previewEndsAt: room.previewEndsAt,
    biddingEndsAt: room.biddingEndsAt,
    lastSold: room.lastSold || null,        // for the 10s 'sold' display
    nextAuctionAt: room.nextAuctionAt || null,
    poolSize: room.playerPool ? room.playerPool.length : 0,
    soldCount: room.soldLog ? room.soldLog.length : 0,
  };
}

function emitState(room) {
  if (!io) return;
  io.to(room.id).emit('room_state', publicState(room));
}

function emitPrivate(room, userId) {
  if (!io) return;
  const m = room.members[userId];
  if (!m) return;
  io.to(`user:${userId}`).emit('private_state', {
    roomId: room.id,
    wallet: m.wallet,
    squad: m.squad,
    team: m.team,
  });
}

function emitPrivateAll(room) {
  for (const uid of Object.keys(room.members)) emitPrivate(room, uid);
}

// ---------- room lifecycle ----------

function createRoom({ hostId, hostUsername, maxPlayers = 10, timerSec = 10 }) {
  if (maxPlayers < 2 || maxPlayers > 10) throw new Error('maxPlayers must be 2..10');
  if (timerSec < 8 || timerSec > 15) throw new Error('timerSec must be 8..15');
  const id = nanoid(6);
  const room = {
    id,
    hostId,
    status: 'waiting',
    config: { timerSec, maxPlayers },
    members: {},
    memberOrder: [],
    teams: {},
    playerPool: null,
    currentIdx: null,
    currentBid: null,
    bidVersion: 0,
    previewEndsAt: null,
    biddingEndsAt: null,
    soldLog: [],
    chat: [],
    captains: {},
  };
  addMember(room, hostId, hostUsername);
  setRoom(id, room);
  saveSnapshot(id);
  return room;
}

function addMember(room, userId, username) {
  if (room.members[userId]) {
    room.members[userId].connected = true;
    room.members[userId].disconnectedAt = null;
    return;
  }
  if (room.status !== 'waiting') throw new Error('room already started');
  if (room.memberOrder.length >= room.config.maxPlayers) throw new Error('room full');
  room.members[userId] = {
    username,
    team: null,
    wallet: BUDGET,
    squad: [],
    connected: true,
    disconnectedAt: null,
  };
  room.memberOrder.push(userId);
}

function removeMember(room, userId) {
  if (room.status === 'waiting') {
    delete room.members[userId];
    // free team
    for (const [t, u] of Object.entries(room.teams)) if (u === userId) delete room.teams[t];
    room.memberOrder = room.memberOrder.filter(u => u !== userId);
    if (room.hostId === userId) {
      room.hostId = room.memberOrder[0] || null;
    }
    if (room.memberOrder.length === 0) {
      deleteRoom(room.id);
      return;
    }
  } else {
    // mark disconnected; grace window
    const m = room.members[userId];
    if (m) {
      m.connected = false;
      m.disconnectedAt = Date.now();
    }
    if (room.hostId === userId) {
      const alt = room.memberOrder.find(u => u !== userId && room.members[u]?.connected);
      if (alt) room.hostId = alt;
    }
  }
  saveSnapshot(room.id);
  emitState(room);
}

function pickTeam(room, userId, team) {
  if (room.status !== 'waiting') throw new Error('team selection closed');
  if (!TEAMS.includes(team)) throw new Error('unknown team');
  if (room.teams[team] && room.teams[team] !== userId) throw new Error('team already taken');
  // release previous
  for (const [t, u] of Object.entries(room.teams)) {
    if (u === userId) delete room.teams[t];
  }
  room.teams[team] = userId;
  room.members[userId].team = team;
  saveSnapshot(room.id);
  emitState(room);
}

// ---------- auction start ----------

function startAuction(room, userId) {
  if (room.hostId !== userId) throw new Error('only host');
  if (room.status !== 'waiting') throw new Error('already started');
  const members = room.memberOrder;
  if (members.length < 2) throw new Error('need 2+ players');
  for (const uid of members) {
    if (!room.members[uid].team) throw new Error('all players must pick a team');
  }

  // Pool: N*11 players sampled (here N<=10 → up to 110). Shuffle full pool and slice.
  const shuffled = secureShuffle(PLAYERS);
  const needed = members.length * SQUAD_SIZE;
  room.playerPool = shuffled.slice(0, needed);
  room.currentIdx = null;
  room.status = 'preview';
  room.previewEndsAt = Date.now() + PREVIEW_MS;
  saveSnapshot(room.id);
  emitState(room);

  setTimeoutSafe(room, PREVIEW_MS, () => {
    beginNextPlayer(room);
  });
}

// ---------- bidding ----------

function beginNextPlayer(room) {
  if (!room) return;
  const nextIdx = room.currentIdx == null ? 0 : room.currentIdx + 1;
  if (nextIdx >= room.playerPool.length) {
    return finishAuction(room);
  }
  room.currentIdx = nextIdx;
  room.currentBid = null;
  room.bidVersion += 1;
  room.status = 'auction';
  room.lastSold = null;
  room.nextAuctionAt = null;
  // First bid window is longer so people can react to a new player
  room.biddingEndsAt = Date.now() + INITIAL_BID_MS;
  saveSnapshot(room.id);
  emitState(room);
  scheduleTimerEnd(room);
}

function scheduleTimerEnd(room) {
  const delay = Math.max(0, room.biddingEndsAt - Date.now());
  setTimeoutSafe(room, delay, () => onTimerEnd(room));
}

function setTimeoutSafe(room, ms, fn) {
  if (room._timer) clearTimeout(room._timer);
  room._timer = setTimeout(() => {
    room._timer = null;
    try { fn(); } catch (e) { log.error('timer fn error', e.message); }
  }, ms);
}

function placeBid(room, userId, { amount, bidVersion }) {
  // --- server-side validation (the ONLY place that matters) ---
  if (room.status !== 'auction') return { ok: false, reason: 'not_in_auction' };
  const m = room.members[userId];
  if (!m) return { ok: false, reason: 'not_in_room' };
  if (!m.connected) return { ok: false, reason: 'disconnected' };
  if (bidVersion != null && bidVersion !== room.bidVersion) return { ok: false, reason: 'stale_bid' };

  const required = room.currentBid ? nextBid(room.currentBid.amount) : BASE_PRICE;
  if (amount !== required) return { ok: false, reason: 'wrong_amount', required };
  if (room.currentBid && room.currentBid.bidderId === userId) return { ok: false, reason: 'already_leading' };
  if (!canAfford(m.wallet, m.squad.length, amount)) return { ok: false, reason: 'budget_lock' };

  // accept
  room.currentBid = { amount, bidderId: userId };
  room.bidVersion += 1;
  room.biddingEndsAt = Date.now() + room.config.timerSec * 1000;
  saveSnapshot(room.id);
  emitState(room);
  scheduleTimerEnd(room);
  return { ok: true };
}

function recordSold(room, { player, bidderId, amount, auto, forced }) {
  const m = room.members[bidderId];
  room.lastSold = {
    playerId: player.id,
    playerName: player.name,
    playerRating: player.rating,
    bidderId,
    bidderName: m?.username || null,
    team: m?.team || null,
    amount,
    auto: !!auto,
    forced: !!forced,
  };
  room.status = 'sold';
  room.nextAuctionAt = Date.now() + SOLD_PAUSE_MS;
  room.currentBid = null; // lock bidding during pause
  room.bidVersion += 1;
}

function onTimerEnd(room) {
  if (room.status !== 'auction') return;
  const player = room.playerPool[room.currentIdx];
  if (room.currentBid) {
    const { bidderId, amount } = room.currentBid;
    const m = room.members[bidderId];
    m.wallet -= amount;
    m.squad.push(player.id);
    room.soldLog.push({ playerId: player.id, bidderId, amount });
    io.to(room.id).emit('player_sold', { playerId: player.id, bidderId, amount, auto: false });
    recordSold(room, { player, bidderId, amount, auto: false });
  } else {
    // auto-sell: pick user with smallest squad who can afford base price and hasn't filled
    const eligible = room.memberOrder
      .map(uid => room.members[uid])
      .map((m, i) => ({ uid: room.memberOrder[i], m }))
      .filter(({ m }) => m.squad.length < SQUAD_SIZE && canAfford(m.wallet, m.squad.length, BASE_PRICE));
    if (eligible.length > 0) {
      eligible.sort((a, b) => a.m.squad.length - b.m.squad.length || Math.random() - 0.5);
      const { uid, m } = eligible[0];
      m.wallet -= BASE_PRICE;
      m.squad.push(player.id);
      room.soldLog.push({ playerId: player.id, bidderId: uid, amount: BASE_PRICE });
      io.to(room.id).emit('player_sold', { playerId: player.id, bidderId: uid, amount: BASE_PRICE, auto: true });
      recordSold(room, { player, bidderId: uid, amount: BASE_PRICE, auto: true });
    } else {
      // nobody can afford — force-assign to smallest squad regardless (deadlock break)
      const order = room.memberOrder
        .filter(uid => room.members[uid].squad.length < SQUAD_SIZE)
        .sort((a, b) => room.members[a].squad.length - room.members[b].squad.length);
      if (order.length) {
        const uid = order[0];
        const m = room.members[uid];
        m.squad.push(player.id);
        const paid = Math.min(m.wallet, BASE_PRICE);
        m.wallet -= paid;
        room.soldLog.push({ playerId: player.id, bidderId: uid, amount: paid, forced: true });
        io.to(room.id).emit('player_sold', { playerId: player.id, bidderId: uid, amount: paid, auto: true, forced: true });
        recordSold(room, { player, bidderId: uid, amount: paid, auto: true, forced: true });
      }
    }
  }
  emitPrivateAll(room);
  emitState(room);
  saveSnapshot(room.id);
  // 10s pause showing "sold to X" before the next player
  setTimeoutSafe(room, SOLD_PAUSE_MS, () => beginNextPlayer(room));
}

// ---------- end of auction ----------

function finishAuction(room) {
  room.status = 'captain';
  room.currentBid = null;
  room.currentIdx = null;
  room.biddingEndsAt = null;
  // 20s to pick; then auto-assign
  const pickEndsAt = Date.now() + 20000;
  room.pickEndsAt = pickEndsAt;
  saveSnapshot(room.id);
  emitState(room);
  io.to(room.id).emit('auction_complete');

  setTimeoutSafe(room, 20000, () => {
    for (const uid of room.memberOrder) {
      if (!room.captains[uid]) autoAssignCaptains(room, uid);
    }
    completeGame(room);
  });
}

function autoAssignCaptains(room, userId) {
  const m = room.members[userId];
  const sorted = m.squad
    .map(pid => PLAYERS.find(p => p.id === pid))
    .filter(Boolean)
    .sort((a, b) => b.rating - a.rating);
  if (sorted.length === 0) return;
  const cap = sorted[0].id;
  const vc = sorted[1] ? sorted[1].id : null;
  room.captains[userId] = { captain: cap, viceCaptain: vc };
}

function pickCaptains(room, userId, { captain, viceCaptain }) {
  if (room.status !== 'captain') throw new Error('not in captain phase');
  const m = room.members[userId];
  if (!m) throw new Error('not in room');
  if (!m.squad.includes(captain)) throw new Error('captain not in squad');
  if (viceCaptain && !m.squad.includes(viceCaptain)) throw new Error('vc not in squad');
  if (captain === viceCaptain) throw new Error('captain and vc must differ');
  room.captains[userId] = { captain, viceCaptain: viceCaptain || null };
  saveSnapshot(room.id);
  emitState(room);
}

function completeGame(room) {
  room.status = 'completed';
  // compute scores
  const results = room.memberOrder.map(uid => {
    const m = room.members[uid];
    const caps = room.captains[uid] || {};
    const squadPlayers = m.squad.map(pid => PLAYERS.find(p => p.id === pid)).filter(Boolean);
    const capRating = caps.captain ? (PLAYERS.find(p => p.id === caps.captain)?.rating || 0) : 0;
    const vcRating = caps.viceCaptain ? (PLAYERS.find(p => p.id === caps.viceCaptain)?.rating || 0) : 0;
    const sumRating = squadPlayers.reduce((s, p) => s + p.rating, 0);
    // Formula per spec: total = Σ ratings + 2*captain + 1.5*viceCaptain
    const totalPoints = +(sumRating + 2 * capRating + 1.5 * vcRating).toFixed(2);
    return {
      userId: uid,
      username: m.username,
      team: m.team,
      totalPoints,
      sumRating: +sumRating.toFixed(2),
      captainRating: capRating,
      viceCaptainRating: vcRating,
      captain: caps.captain,
      viceCaptain: caps.viceCaptain,
      squad: squadPlayers,
      remainingBudget: m.wallet,
    };
  });
  results.sort((a, b) =>
    b.totalPoints - a.totalPoints ||
    b.captainRating - a.captainRating ||
    b.sumRating - a.sumRating ||
    b.remainingBudget - a.remainingBudget
  );
  room.leaderboard = results;
  saveSnapshot(room.id);
  emitState(room);
  io.to(room.id).emit('leaderboard', results);
}

// ---------- disconnect handling ----------

function handleDisconnect(room, userId) {
  const m = room.members[userId];
  if (!m) return;
  m.connected = false;
  m.disconnectedAt = Date.now();
  saveSnapshot(room.id);
  emitState(room);
}

function handleReconnect(room, userId) {
  const m = room.members[userId];
  if (!m) return false;
  m.connected = true;
  m.disconnectedAt = null;
  saveSnapshot(room.id);
  emitState(room);
  emitPrivate(room, userId);
  return true;
}

module.exports = {
  init,
  TEAMS,
  createRoom,
  addMember,
  removeMember,
  pickTeam,
  startAuction,
  placeBid,
  pickCaptains,
  handleDisconnect,
  handleReconnect,
  publicState,
  emitState,
  emitPrivate,
  emitPrivateAll,
};
