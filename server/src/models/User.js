const mongoose = require('mongoose');
const { isConnected } = require('../config/db');

const UserSchema = new mongoose.Schema({
  username: { type: String, unique: true, required: true, index: true },
  passwordHash: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

const MongoUser = mongoose.model('User', UserSchema);

// In-memory fallback store
const mem = new Map(); // username -> { _id, username, passwordHash }
let memId = 1;

const User = {
  async findByUsername(username) {
    if (isConnected()) return MongoUser.findOne({ username }).lean();
    return mem.get(username) || null;
  },
  async findById(id) {
    if (isConnected()) return MongoUser.findById(id).lean();
    for (const u of mem.values()) if (String(u._id) === String(id)) return u;
    return null;
  },
  async create({ username, passwordHash }) {
    if (isConnected()) {
      const doc = await MongoUser.create({ username, passwordHash });
      return doc.toObject();
    }
    if (mem.has(username)) throw new Error('duplicate');
    const u = { _id: String(memId++), username, passwordHash, createdAt: new Date() };
    mem.set(username, u);
    return u;
  },
};

module.exports = User;
