// Game state persistence + in-memory cache.
// Each room's live state is kept in memory (for speed) and snapshotted to Redis
// after every mutation for crash recovery.

const { getClient } = require('../config/redis');

const rooms = new Map(); // roomId -> state

function key(roomId) { return `room:${roomId}`; }

async function saveSnapshot(roomId) {
  const state = rooms.get(roomId);
  if (!state) return;
  const client = getClient();
  if (!client) return;
  try {
    // strip non-serializable fields (timers)
    const { _timer, ...serializable } = state;
    await client.set(key(roomId), JSON.stringify(serializable), 'EX', 60 * 60 * 6);
  } catch {}
}

async function loadSnapshot(roomId) {
  const client = getClient();
  if (!client) return null;
  try {
    const raw = await client.get(key(roomId));
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function getRoom(roomId) { return rooms.get(roomId); }
function setRoom(roomId, state) { rooms.set(roomId, state); }
function deleteRoom(roomId) {
  const s = rooms.get(roomId);
  if (s && s._timer) clearTimeout(s._timer);
  rooms.delete(roomId);
  const client = getClient();
  if (client) client.del(key(roomId)).catch(() => {});
}
function listRooms() { return Array.from(rooms.values()); }

module.exports = { getRoom, setRoom, deleteRoom, listRooms, saveSnapshot, loadSnapshot };
