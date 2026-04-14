// All money in INTEGER lakhs. No floats.
const BUDGET = 5000;          // 50 Cr
const BASE_PRICE = 20;        // 20L
const SQUAD_SIZE = 11;

// Increment table: given current highest bid, return next valid bid.
function nextBid(current) {
  if (current < BASE_PRICE) return BASE_PRICE;
  if (current < 100) return current + 20;
  if (current < 500) return current + 25;
  return current + 50;
}

// Smart budget lock: a user can commit `amount` only if the remaining budget
// after deduction still covers BASE_PRICE for every remaining slot.
// remainingSlots = SQUAD_SIZE - squadSize (BEFORE buying this one)
// After winning this player at `amount`, they'll have remainingSlots-1 slots left.
function canAfford(wallet, squadSize, amount) {
  if (squadSize >= SQUAD_SIZE) return false;
  if (amount > wallet) return false;
  const slotsAfter = SQUAD_SIZE - squadSize - 1;
  const mustRetain = slotsAfter * BASE_PRICE;
  return (wallet - amount) >= mustRetain;
}

// Max bid this user is legally allowed to place right now.
function maxBid(wallet, squadSize) {
  const slotsAfter = SQUAD_SIZE - squadSize - 1;
  return wallet - slotsAfter * BASE_PRICE;
}

module.exports = { BUDGET, BASE_PRICE, SQUAD_SIZE, nextBid, canAfford, maxBid };
