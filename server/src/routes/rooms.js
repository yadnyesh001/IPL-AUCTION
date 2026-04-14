const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { getRoom } = require('../services/gameState');
const { publicState, TEAMS } = require('../services/auctionEngine');
const PLAYERS = require('../data/players');

const router = express.Router();

router.get('/teams', (req, res) => res.json({ teams: TEAMS }));

router.get('/players', (req, res) => res.json({ players: PLAYERS }));

router.get('/:id', requireAuth, (req, res) => {
  const room = getRoom(req.params.id);
  if (!room) return res.status(404).json({ error: 'not found' });
  res.json({ room: publicState(room) });
});

module.exports = router;
