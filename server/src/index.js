require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');

const log = require('./utils/logger');
const { connectDB } = require('./config/db');
const { initRedis } = require('./config/redis');
const { attachSockets } = require('./sockets');

const authRoutes = require('./routes/auth');
const roomRoutes = require('./routes/rooms');

async function main() {
  if (!process.env.JWT_SECRET) {
    process.env.JWT_SECRET = 'dev_insecure_secret_change_me';
    log.warn('JWT_SECRET not set — using insecure dev default.');
  }

  await connectDB();
  await initRedis();

  const app = express();
  const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
  app.use(cors({ origin: CLIENT_ORIGIN, credentials: true }));
  app.use(express.json({ limit: '64kb' }));

  app.get('/health', (_, res) => res.json({ ok: true }));
  app.use('/api/auth', authRoutes);
  app.use('/api/rooms', roomRoutes);

  // global error guard
  app.use((err, req, res, _next) => {
    log.error('HTTP error', err.message);
    res.status(500).json({ error: 'internal_error' });
  });

  const server = http.createServer(app);
  const io = new Server(server, {
    cors: { origin: CLIENT_ORIGIN, credentials: true },
    pingTimeout: 20000,
  });
  attachSockets(io);

  const PORT = Number(process.env.PORT || 4000);
  server.listen(PORT, () => log.info(`server listening on :${PORT}`));

  process.on('unhandledRejection', (e) => log.error('unhandledRejection', e));
  process.on('uncaughtException', (e) => log.error('uncaughtException', e));
}

main();
