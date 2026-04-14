const crypto = require('crypto');
const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function nanoid(len = 6) {
  const bytes = crypto.randomBytes(len);
  let out = '';
  for (let i = 0; i < len; i++) out += ALPHA[bytes[i] % ALPHA.length];
  return out;
}
module.exports = { nanoid };
