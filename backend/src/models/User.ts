import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  name: string;
  role: 'patient' | 'donor' | 'admin';
  bloodGroup?: string;
  location?: {
    type: string;
    coordinates: number[];
  };
  distance?: number; // mock for UI
  lastDonated?: Date;
  donationsCount?: number;
  score?: number;
  initials?: string;
  avail?: 'Available' | 'Maybe' | 'Offline';
}

const UserSchema: Schema = new Schema({
  name: { type: String, required: true },
  email: { type: String, trim: true, lowercase: true, sparse: true, unique: true },
  password: { type: String },
  role: { type: String, enum: ['patient', 'donor', 'admin'], required: true },
  bloodGroup: { type: String },
  location: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], index: '2dsphere' }
  },
  distance: { type: Number, default: 0 },
  lastDonated: { type: Date },
  donationsCount: { type: Number, default: 0 },
  score: { type: Number, default: 0 },
  initials: { type: String },
  avail: { type: String, enum: ['Available', 'Maybe', 'Offline'], default: 'Available' }
});

export default mongoose.model<IUser>('User', UserSchema);
