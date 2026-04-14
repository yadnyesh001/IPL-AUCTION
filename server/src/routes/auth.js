const express = require('express');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { sign, requireAuth } = require('../middleware/auth');

const router = express.Router();

router.post('/register', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'username and password required' });
  if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) return res.status(400).json({ error: 'invalid username' });
  if (password.length < 6) return res.status(400).json({ error: 'password too short' });

  const existing = await User.findByUsername(username);
  if (existing) return res.status(409).json({ error: 'username taken' });

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({ username, passwordHash });
  const token = sign(user);
  res.json({ token, user: { id: String(user._id), username: user.username } });
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'username and password required' });
  const user = await User.findByUsername(username);
  if (!user) return res.status(401).json({ error: 'invalid credentials' });
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: 'invalid credentials' });
  const token = sign(user);
  res.json({ token, user: { id: String(user._id), username: user.username } });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
