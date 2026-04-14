import mongoose from 'mongoose';

const PlayerSchema = new mongoose.Schema({
  pid: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true },
  rating: { type: Number, required: true }, // 6.0–10.0
  image: { type: String, default: '' },
});

export default mongoose.model('Player', PlayerSchema);
