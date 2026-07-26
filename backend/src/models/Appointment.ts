import mongoose, { Schema, Document } from 'mongoose';

export interface IAppointment extends Document {
  patientId: mongoose.Types.ObjectId;
  date: string;
  time: string;
  type: 'transfusion' | 'checkup' | 'consultation';
  hospital: string;
  doctor?: string;
  notes?: string;
  source: 'planned' | 'predicted' | 'history';
  status: 'upcoming' | 'completed';
}

const appointmentSchema: Schema = new Schema(
  {
    patientId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: String, required: true },
    time: { type: String, default: '10:00 AM' },
    type: {
      type: String,
      enum: ['transfusion', 'checkup', 'consultation'],
      required: true,
    },
    hospital: { type: String, required: true },
    doctor: { type: String },
    notes: { type: String },
    source: {
      type: String,
      enum: ['planned', 'predicted', 'history'],
      default: 'planned',
    },
    status: {
      type: String,
      enum: ['upcoming', 'completed'],
      default: 'upcoming',
    },
  },
  { timestamps: true }
);

appointmentSchema.index({ patientId: 1, date: 1 });

export default mongoose.model<IAppointment>('Appointment', appointmentSchema);
