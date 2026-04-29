import mongoose, { Schema, Document } from 'mongoose';

export interface ISOSAlert extends Document {
  patientId?: mongoose.Types.ObjectId | null;
  bloodGroup: string;
  location: {
    type: string;
    coordinates: number[];
  };
  hospital?: string;
  status: 'active' | 'resolved' | 'expired' | 'dispatched';
  donorsNotified?: mongoose.Types.ObjectId[];
  whatsappSent?: boolean;
  hospitalNotified?: boolean;
  responders: {
    donorId: mongoose.Types.ObjectId;
    response: 'accepted' | 'rejected';
    respondedAt: Date;
  }[];
  acceptedDonor?: mongoose.Types.ObjectId;
  targetedDonor?: mongoose.Types.ObjectId;
  requestType: 'sos' | 'direct';
  deliveryLogs: {
    channel: 'socket' | 'email';
    recipientUserId?: mongoose.Types.ObjectId;
    recipientEmail?: string;
    event: string;
    status: 'sent' | 'failed' | 'skipped';
    reason?: string;
    createdAt: Date;
  }[];
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const sosSchema: Schema = new Schema(
  {
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false, default: null },
    bloodGroup: { type: String, required: true },
    location: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], required: true }
    },
    hospital: { type: String },
    status: { type: String, enum: ['active', 'resolved', 'expired', 'dispatched'], default: 'active' },
    donorsNotified: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    whatsappSent: { type: Boolean, default: false },
    hospitalNotified: { type: Boolean, default: false },
    responders: [
      {
        donorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        response: { type: String, enum: ['accepted', 'rejected'] },
        respondedAt: { type: Date, default: Date.now }
      }
    ],
    acceptedDonor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    targetedDonor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    requestType: { type: String, enum: ['sos', 'direct'], default: 'sos' },
    deliveryLogs: [
      {
        channel: { type: String, enum: ['socket', 'email'], required: true },
        recipientUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        recipientEmail: { type: String },
        event: { type: String, required: true },
        status: { type: String, enum: ['sent', 'failed', 'skipped'], required: true },
        reason: { type: String },
        createdAt: { type: Date, default: Date.now },
      }
    ],
    expiresAt: { type: Date, default: () => new Date(Date.now() + 10 * 60 * 1000) } // 10 minutes
  },
  { timestamps: true }
);

sosSchema.index({ location: '2dsphere' });

export default mongoose.model<ISOSAlert>('SOSAlert', sosSchema);
