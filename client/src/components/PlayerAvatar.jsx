import React from 'react';

// Palette of high-contrast gradients (dark → lighter) so initials always read
// clearly against a white or light foreground.
const PALETTE = [
  ['#1a2a6c', '#b21f1f'], // deep blue → crimson
  ['#0f2027', '#2c5364'], // steel
  ['#134e5e', '#71b280'], // forest
  ['#614385', '#516395'], // purple
  ['#c31432', '#240b36'], // cherry noir
  ['#ff512f', '#dd2476'], // sunset
  ['#200122', '#6f0000'], // burgundy
  ['#16222a', '#3a6073'], // ocean
  ['#2b5876', '#4e4376'], // twilight
  ['#642b73', '#c6426e'], // magenta
  ['#1e3c72', '#2a5298'], // royal
  ['#3e5151', '#decba4'], // mist
  ['#355c7d', '#6c5b7b'], // dusk
  ['#870000', '#190a05'], // ember
  ['#232526', '#414345'], // graphite
];

// Stable 32-bit hash from a string (djb2 variant).
function hash(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function initialsOf(name) {
  const parts = String(name).trim().split(/\s+/).slice(0, 2);
  return parts.map(p => p[0]?.toUpperCase() || '').join('') || '?';
}

export function avatarStyle(name) {
  const h = hash(name);
  const [a, b] = PALETTE[h % PALETTE.length];
  return { background: `linear-gradient(135deg, ${a} 0%, ${b} 100%)` };
}

export default function PlayerAvatar({ name, size = 48, className = '' }) {
  const initials = initialsOf(name);
  const style = {
    ...avatarStyle(name),
    width: size,
    height: size,
    fontSize: Math.max(12, Math.round(size * 0.38)),
  };
  return (
    <div className={`avatar ${className}`} style={style} aria-label={name}>
      <span>{initials}</span>
    </div>
  );
}
