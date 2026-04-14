import mongoose from 'mongoose';

const ParticipantSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    username: String,
    team: { type: String, default: null },
    budget: { type: Number, default: 5000 }, // lakhs
    squad: [
      {
        pid: String,
        name: String,
        rating: Number,
        price: Number,
      },
    ],
    captainPid: { type: String, default: null },
    viceCaptainPid: { type: String, default: null },
    connected: { type: Boolean, default: true },
  },
  { _id: false }
);

const RoomSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, index: true },
    hostId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    capacity: { type: Number, default: 4, min: 2, max: 10 },
    timerSec: { type: Number, default: 10, min: 8, max: 15 },
    status: {
      type: String,
      enum: ['waiting', 'preview', 'active', 'captains', 'completed'],
      default: 'waiting',
    },
    participants: [ParticipantSchema],
    playerPool: [
      {
        pid: String,
        name: String,
        rating: Number,
        image: String,
      },
    ],
    currentIndex: { type: Number, default: 0 },
    bidHistory: [
      {
        pid: String,
        winnerUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        price: Number,
        at: { type: Date, default: Date.now },
      },
    ],
    leaderboard: { type: Array, default: [] },
  },
  { timestamps: true }
);

export default mongoose.model('Room', RoomSchema);
