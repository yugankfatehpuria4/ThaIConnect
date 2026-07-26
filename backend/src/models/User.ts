import mongoose, { Schema, Document } from 'mongoose';

export interface ITransfusion {
  date: Date;
  hb: number;
  units: number;
  hospital: string;
}

export interface IUser extends Document {
  name: string;
  email?: string;
  phone?: string;
  password?: string;
  role: 'patient' | 'donor' | 'admin';
  bloodGroup?: string;
  location?: {
    type: string;
    coordinates: number[];
  };
  distance?: number;
  lastDonated?: Date;
  donationsCount?: number;
  score?: number;
  initials?: string;
  avail?: 'Available' | 'Maybe' | 'Offline';
  transfusions?: ITransfusion[];
}

const TransfusionSchema = new Schema(
  {
    date: { type: Date, required: true },
    hb: { type: Number, required: true },
    units: { type: Number, required: true, default: 2 },
    hospital: { type: String, required: true },
  },
  { _id: false }
);

const UserSchema: Schema = new Schema(
  {
    name: { type: String, required: true },
    email: { type: String, trim: true, lowercase: true, sparse: true, unique: true },
    phone: { type: String },
    password: { type: String },
    role: { type: String, enum: ['patient', 'donor', 'admin'], required: true },
    bloodGroup: { type: String, enum: ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'] },
    // No default coordinates: a user without a real location must NOT be placed
    // at a fake point (previously central Delhi), which would wrongly match them
    // in $near SOS queries. Location is set only when the user actually provides it.
    location: {
      type: { type: String, enum: ['Point'] },
      coordinates: { type: [Number] },
    },
    distance: { type: Number, default: 0 },
    lastDonated: { type: Date },
    donationsCount: { type: Number, default: 0 },
    score: { type: Number, default: 0 },
    initials: { type: String },
    avail: { type: String, enum: ['Available', 'Maybe', 'Offline'], default: 'Available' },
    transfusions: { type: [TransfusionSchema], default: [] },
  },
  { timestamps: true }
);

// Sparse 2dsphere index: users without a location are simply excluded from geo
// queries instead of appearing at a fake default point.
UserSchema.index({ location: '2dsphere' });

export default mongoose.model<IUser>('User', UserSchema);
