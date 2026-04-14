import { Router } from 'express';
import Player from '../models/Player.js';

const r = Router();
r.get('/', async (_req, res) => {
  const players = await Player.find().lean();
  res.json({ players });
});
export default r;
