import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getSocket } from '../socket.js';
import { api } from '../api.js';

export default function Result() {
  const { code } = useParams();
  const nav = useNavigate();
  const [board, setBoard] = useState([]);

  useEffect(() => {
    const s = getSocket();
    const onBoard = ({ board }) => setBoard(board);
    s.on('leaderboard', onBoard);
    // also fetch in case we missed the event
    api.getRoom(code).then((r) => {
      if (r.room?.leaderboard?.length) setBoard(r.room.leaderboard);
    }).catch(() => {});
    return () => s.off('leaderboard', onBoard);
  }, [code]);

  return (
    <div className="center">
      <div className="card wide">
        <h1>Leaderboard — Room {code}</h1>
        {!board.length && <div className="muted">Waiting for results…</div>}
        {board.map((row) => (
          <div key={row.username} className={`lb-row rank-${row.rank}`}>
            <div className="rank">#{row.rank}</div>
            <div>
              <div><b>{row.username}</b> <span className="team">{row.team}</span></div>
              <div className="muted">
                C: {row.captain?.name || '—'} · VC: {row.viceCaptain?.name || '—'}
              </div>
              <div className="muted">Squad: {row.squad?.length || 0} · Budget left: ₹{row.budgetLeft}L</div>
            </div>
            <div className="pts">{row.points} pts</div>
          </div>
        ))}
        <button onClick={() => nav('/')}>Back to lobby</button>
      </div>
    </div>
  );
}
