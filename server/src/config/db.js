const mongoose = require('mongoose');
const log = require('../utils/logger');

let connected = false;

async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    log.warn('MONGODB_URI not set — running without MongoDB (in-memory user store).');
    return false;
  }
  try {
    await mongoose.connect(uri);
    connected = true;
    log.info('MongoDB connected');
    return true;
  } catch (e) {
    log.error('MongoDB connect failed, falling back to memory:', e.message);
    return false;
  }
}

const isConnected = () => connected;

module.exports = { connectDB, isConnected };
