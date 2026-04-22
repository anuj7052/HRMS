import mongoose, { Document, Schema } from 'mongoose';

export interface IShift extends Document {
  name: string;
  startTime: string;           // 'HH:MM'
  endTime: string;             // 'HH:MM'
  gracePeriodMinutes: number;  // minutes after startTime before marked Late
  halfDayThresholdHours: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ShiftSchema = new Schema<IShift>(
  {
    name: { type: String, required: true, trim: true, unique: true },
    startTime: { type: String, required: true, default: '09:00' },
    endTime: { type: String, required: true, default: '18:00' },
    gracePeriodMinutes: { type: Number, default: 15, min: 0 },
    halfDayThresholdHours: { type: Number, default: 4, min: 1 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const Shift = mongoose.model<IShift>('Shift', ShiftSchema);
