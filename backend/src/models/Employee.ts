import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IEmployee extends Document {
  userId: Types.ObjectId;
  employeeId: string;
  department: string;
  designation: string;
  shift: string;
  shiftId?: Types.ObjectId;  // ref to Shift model; if set, overrides global AppSettings shift times
  joinDate: Date;
  phone?: string;
  address?: string;
  emergencyContact?: string;
  devicePin?: string;  // biometric device PIN (numeric) — set to match RawPunchLog.employeeDeviceId
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const EmployeeSchema = new Schema<IEmployee>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    employeeId: { type: String, required: true, unique: true, trim: true },
    department: { type: String, required: true, trim: true },
    designation: { type: String, required: true, trim: true },
    shift: { type: String, default: 'General' },
    shiftId: { type: Schema.Types.ObjectId, ref: 'Shift' },
    joinDate: { type: Date, required: true },
    phone: { type: String, trim: true },
    address: { type: String, trim: true },
    emergencyContact: { type: String, trim: true },
    devicePin: { type: String, trim: true },  // biometric device PIN
  isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

EmployeeSchema.index({ department: 1 });
EmployeeSchema.index({ employeeId: 1 });

export const Employee = mongoose.model<IEmployee>('Employee', EmployeeSchema);
