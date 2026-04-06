import mongoose, { Schema, Document } from 'mongoose';

export interface IAchievement extends Document {
  donorId: mongoose.Types.ObjectId;
  badges: string[];
  milestones: {
    bronze: boolean;
    silver: boolean;
    gold: boolean;
  };
}

const achievementSchema: Schema = new Schema({
  donorId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  badges: { type: [String], default: [] },
  milestones: {
    bronze: { type: Boolean, default: false },
    silver: { type: Boolean, default: false },
    gold: { type: Boolean, default: false },
  }
}, { timestamps: true });

export default mongoose.model<IAchievement>('Achievement', achievementSchema);
