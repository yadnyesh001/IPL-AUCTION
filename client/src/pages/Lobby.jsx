import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store';

export default function Lobby() {
  const { socket } = useStore();
  const nav = useNavigate();
  const [maxPlayers, setMax] = useState(4);
  const [timerSec, setTimer] = useState(10);
  const [joinId, setJoinId] = useState('');
  const [err, setErr] = useState(null);

  function create() {
    setErr(null);
    socket.emit('create_room', { maxPlayers, timerSec }, (res) => {
      if (res.ok) nav(`/room/${res.roomId}`);
      else setErr(res.error);
    });
  }
  function join() {
    setErr(null);
    socket.emit('join_room', { roomId: joinId.trim().toUpperCase() }, (res) => {
      if (res.ok) nav(`/room/${res.roomId}`);
      else setErr(res.error);
    });
  }

  return (
    <div className="grid-2">
      <div className="card">
        <h2>Create room</h2>
        <label>Max players (2–10)
          <input type="number" min="2" max="10" value={maxPlayers} onChange={e => setMax(+e.target.value)} />
        </label>
        <label>Timer (8–15 sec)
          <input type="number" min="8" max="15" value={timerSec} onChange={e => setTimer(+e.target.value)} />
        </label>
        <button onClick={create} disabled={!socket}>Create</button>
      </div>
      <div className="card">
        <h2>Join room</h2>
        <label>Room code
          <input value={joinId} onChange={e => setJoinId(e.target.value)} placeholder="ABC123" />
        </label>
        <button onClick={join} disabled={!socket || !joinId}>Join</button>
      </div>
      {err && <div className="error">{err}</div>}
    </div>
  );
}
