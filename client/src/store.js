import { create } from 'zustand';
import { io } from 'socket.io-client';
import { SERVER_URL } from './api';

export const useStore = create((set, get) => ({
  token: localStorage.getItem('token') || null,
  user: JSON.parse(localStorage.getItem('user') || 'null'),
  socket: null,
  room: null,          // public room state
  priv: null,          // private state (wallet, squad)
  players: [],         // full player catalog id->obj
  playersById: {},
  chat: [],
  lastBidResult: null,
  toast: null,

  setAuth({ token, user }) {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    set({ token, user });
  },

  logout() {
    get().socket?.disconnect();
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    set({ token: null, user: null, socket: null, room: null, priv: null });
  },

  setPlayers(list) {
    const map = {};
    for (const p of list) map[p.id] = p;
    set({ players: list, playersById: map });
  },

  toastMsg(text) {
    set({ toast: text });
    setTimeout(() => set({ toast: null }), 2500);
  },

  connectSocket() {
    const { token, socket } = get();
    if (!token || socket) return;
    const s = io(SERVER_URL, { auth: { token }, transports: ['websocket'] });

    s.on('connect', () => {/* connected */});
    s.on('connect_error', (e) => get().toastMsg('Socket error: ' + e.message));
    s.on('kicked', ({ reason }) => {
      get().toastMsg(`Disconnected: ${reason}`);
      get().logout();
    });
    s.on('room_state', (room) => set({ room }));
    s.on('private_state', (priv) => set({ priv }));
    s.on('chat', (msg) => set({ chat: [...get().chat, msg].slice(-100) }));
    s.on('bid_result', (r) => {
      set({ lastBidResult: r });
      if (!r.accepted) get().toastMsg(`Bid rejected: ${r.reason}`);
    });
    s.on('player_sold', (e) => {
      const p = get().playersById[e.playerId];
      const m = get().room?.members?.[e.bidderId];
      get().toastMsg(`${p?.name || e.playerId} → ${m?.username || 'someone'} @ ₹${e.amount}L${e.auto ? ' (auto)' : ''}`);
    });
    s.on('leaderboard', (lb) => set({ leaderboard: lb }));
    s.on('auction_complete', () => get().toastMsg('Auction complete! Pick captains.'));

    set({ socket: s });
  },
}));
