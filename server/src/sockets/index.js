const { verify } = require('../middleware/auth');
const engine = require('../services/auctionEngine');
const { getRoom, listRooms } = require('../services/gameState');
const { getClient } = require('../config/redis');
const log = require('../utils/logger');

// Enforce single active socket per user via Redis (or memory fallback).
async function claimSession(userId, socketId) {
  const client = getClient();
  const key = `session:socket:${userId}`;
  const existing = await client.get(key);
  await client.set(key, socketId, 'EX', 60 * 60 * 12);
  return existing;
}
async function releaseSession(userId, socketId) {
  const client = getClient();
  const key = `session:socket:${userId}`;
  const existing = await client.get(key);
  if (existing === socketId) await client.del(key);
}

function attachSockets(io) {
  engine.init(io);

  // JWT handshake
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    const payload = token && verify(token);
    if (!payload) return next(new Error('unauthorized'));
    socket.data.userId = payload.sub;
    socket.data.username = payload.username;
    next();
  });

  io.on('connection', async (socket) => {
    const { userId, username } = socket.data;
    log.info(`socket connect ${username} ${socket.id}`);

    // Single-session enforcement: kick any previous socket for this user
    const prev = await claimSession(userId, socket.id);
    if (prev && prev !== socket.id) {
      const prevSock = io.sockets.sockets.get(prev);
      if (prevSock) {
        prevSock.emit('kicked', { reason: 'another_session' });
        prevSock.disconnect(true);
      }
    }

    // Personal channel used for private_state events
    socket.join(`user:${userId}`);

    // Find any room this user belongs to and auto-rejoin.
    // Tell the client so it can navigate them back into the live game.
    for (const room of listRooms()) {
      if (room.members[userId]) {
        socket.join(room.id);
        engine.handleReconnect(room, userId);
        socket.emit('your_active_room', { roomId: room.id, status: room.status });
        break; // a user is only ever in one room
      }
    }

    // ---------------- ROOM ----------------
    socket.on('create_room', ({ maxPlayers, timerSec }, cb) => {
      try {
        const room = engine.createRoom({ hostId: userId, hostUsername: username, maxPlayers, timerSec });
        socket.join(room.id);
        engine.emitState(room);
        engine.emitPrivate(room, userId);
        cb?.({ ok: true, roomId: room.id });
      } catch (e) { cb?.({ ok: false, error: e.message }); }
    });

    socket.on('join_room', ({ roomId }, cb) => {
      try {
        const room = getRoom(roomId);
        if (!room) throw new Error('room not found');
        engine.addMember(room, userId, username);
        socket.join(room.id);
        engine.emitState(room);
        engine.emitPrivate(room, userId);
        cb?.({ ok: true, roomId });
      } catch (e) { cb?.({ ok: false, error: e.message }); }
    });

    socket.on('leave_room', ({ roomId }, cb) => {
      try {
        const room = getRoom(roomId);
        if (!room) return cb?.({ ok: true });
        engine.removeMember(room, userId);
        socket.leave(roomId);
        cb?.({ ok: true });
      } catch (e) { cb?.({ ok: false, error: e.message }); }
    });

    socket.on('pick_team', ({ roomId, team }, cb) => {
      try {
        const room = getRoom(roomId);
        if (!room) throw new Error('room not found');
        engine.pickTeam(room, userId, team);
        cb?.({ ok: true });
      } catch (e) { cb?.({ ok: false, error: e.message }); }
    });

    socket.on('start_auction', ({ roomId }, cb) => {
      try {
        const room = getRoom(roomId);
        if (!room) throw new Error('room not found');
        engine.startAuction(room, userId);
        cb?.({ ok: true });
      } catch (e) { cb?.({ ok: false, error: e.message }); }
    });

    // ---------------- BIDDING ----------------
    socket.on('new_bid', ({ roomId, amount, bidVersion }, cb) => {
      const room = getRoom(roomId);
      if (!room) return cb?.({ ok: false, reason: 'no_room' });
      const result = engine.placeBid(room, userId, { amount, bidVersion });
      // echo pending/result back to this socket
      socket.emit('bid_result', { accepted: result.ok, reason: result.reason, amount });
      cb?.(result);
    });

    // ---------------- CHAT ----------------
    socket.on('chat', ({ roomId, text }) => {
      const room = getRoom(roomId);
      if (!room || !room.members[userId]) return;
      if (typeof text !== 'string' || !text.trim() || text.length > 400) return;
      const msg = { userId, username, text: text.trim(), ts: Date.now() };
      room.chat.push(msg);
      if (room.chat.length > 200) room.chat.shift();
      io.to(roomId).emit('chat', msg);
    });

    // ---------------- DISCONNECT ----------------
    socket.on('disconnect', async () => {
      log.info(`socket disconnect ${username} ${socket.id}`);
      await releaseSession(userId, socket.id);
      for (const room of listRooms()) {
        if (room.members[userId]) engine.handleDisconnect(room, userId);
      }
    });
  });
}

module.exports = { attachSockets };
