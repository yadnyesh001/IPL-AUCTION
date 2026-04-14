const crypto = require('crypto');

// Cryptographically-secure Fisher-Yates shuffle.
// Returns a NEW array; input is not mutated.
function secureShuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    // unbiased random int in [0, i]
    const range = i + 1;
    const max = Math.floor(0xffffffff / range) * range;
    let r;
    do { r = crypto.randomBytes(4).readUInt32BE(0); } while (r >= max);
    const j = r % range;
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

module.exports = { secureShuffle };
