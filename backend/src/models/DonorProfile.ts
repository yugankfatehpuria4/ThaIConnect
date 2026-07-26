import mongoose, { Schema, Document } from 'mongoose';

export interface IDonorProfile extends Document {
  userId: mongoose.Types.ObjectId;
  totalDonations: number;
  lastDonationDate: Date;
  responseStats: {
    totalSOS: number;
    acceptedSOS: number;
  };
  impactPoints: number;
}

const donorProfileSchema: Schema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  totalDonations: { type: Number, default: 0 },
  lastDonationDate: { type: Date },
  responseStats: {
    totalSOS: { type: Number, default: 0 },
    acceptedSOS: { type: Number, default: 0 },
  },
  impactPoints: { type: Number, default: 0 },
}, { timestamps: true });

// Leaderboard sorts by impactPoints desc — avoid a full collection scan + in-memory sort.
donorProfileSchema.index({ impactPoints: -1 });

export default mongoose.model<IDonorProfile>('DonorProfile', donorProfileSchema);
