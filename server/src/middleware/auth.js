const jwt = require('jsonwebtoken');

function sign(user) {
  return jwt.sign(
    { sub: String(user._id), username: user.username },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

function verify(token) {
  try { return jwt.verify(token, process.env.JWT_SECRET); }
  catch { return null; }
}

function requireAuth(req, res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  const payload = token && verify(token);
  if (!payload) return res.status(401).json({ error: 'unauthorized' });
  req.user = { id: payload.sub, username: payload.username };
  next();
}

module.exports = { sign, verify, requireAuth };
