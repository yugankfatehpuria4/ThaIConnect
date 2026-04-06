import mongoose, { Schema, Document } from 'mongoose';

export interface IDonation extends Document {
  donorId: mongoose.Types.ObjectId;
  date: Date;
  location: string; // e.g. "Apollo Delhi"
  type: 'Whole blood' | 'Platelets' | 'Plasma';
  recipientType: 'Thalassemia patient' | 'Emergency SOS' | 'Pending match';
  hbLevel?: number;
  status: 'Completed' | 'Scheduled' | 'Pending';
  hospitalName?: string;
  unitsDonated?: number;
  verified?: boolean;
}

const donationSchema: Schema = new Schema({
  donorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  date: { type: Date, required: true },
  location: { type: String, required: true },
  type: { type: String, required: true },
  recipientType: { type: String, required: true },
  hbLevel: { type: Number },
  status: { type: String, enum: ['Completed', 'Scheduled', 'Pending'], required: true },
  hospitalName: { type: String },
  unitsDonated: { type: Number, default: 1 },
  verified: { type: Boolean, default: false }
}, { timestamps: true });

export default mongoose.model<IDonation>('Donation', donationSchema);
