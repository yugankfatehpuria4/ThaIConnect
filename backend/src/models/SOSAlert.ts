import mongoose, { Schema, Document } from 'mongoose';

export interface ISOSAlert extends Document {
  patientId: mongoose.Types.ObjectId;
  bloodGroupRequired: string;
  location: {
    type: string;
    coordinates: number[];
  };
  hospital: string;
  status: 'pending' | 'accepted' | 'resolved';
  createdAt: Date;
}

const SOSAlertSchema: Schema = new Schema({
  patientId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  bloodGroupRequired: { type: String, required: true },
  location: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], required: true }
  },
  hospital: { type: String, required: true },
  status: { type: String, enum: ['pending', 'accepted', 'resolved'], default: 'pending' },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model<ISOSAlert>('SOSAlert', SOSAlertSchema);
