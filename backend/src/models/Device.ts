import mongoose, { Document, Schema } from 'mongoose';
import bcrypt from 'bcryptjs';

export type DeviceStatus = 'Online' | 'Offline' | 'Unknown';

export interface IDevice extends Document {
  name: string;
  ip: string;
  port: number;
  serialNumber: string;
  username: string;
  passwordHash: string;
  // eTimeTrackLite web portal credentials – AES-256-CBC encrypted so they can be retrieved for auto-sync
  etlUsername?: string;
  etlPassword?: string;   // AES-encrypted plain password (NOT bcrypt)
  autoSync?: boolean;     // auto-fetch from eTimeTrackLite every syncInterval minutes
  syncInterval?: number;  // minutes between auto-fetches (default 5)
  lastEtlSync?: Date;     // last successful ETL fetch
  status: DeviceStatus;
  lastSync?: Date;
  lastError?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  compareDevicePassword(plain: string): Promise<boolean>;
}

const DeviceSchema = new Schema<IDevice>(
  {
    name: { type: String, required: true, trim: true },
    ip: {
      type: String,
      required: true,
      trim: true,
      match: [
        /^(\d{1,3}\.){3}\d{1,3}$/,
        'Invalid IP address format',
      ],
    },
    port: { type: Number, required: true, min: 1, max: 65535, default: 80 },
    serialNumber: { type: String, required: true, unique: true, trim: true },
    username: { type: String, required: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    etlUsername: { type: String, trim: true },
    etlPassword: { type: String, trim: true, select: false },
    autoSync: { type: Boolean, default: false },
    syncInterval: { type: Number, default: 5, min: 1, max: 1440 },
    lastEtlSync: { type: Date },
    status: { type: String, enum: ['Online', 'Offline', 'Unknown'], default: 'Unknown' },
    lastSync: { type: Date },
    lastError: { type: String },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

DeviceSchema.methods.compareDevicePassword = async function (plain: string): Promise<boolean> {
  return bcrypt.compare(plain, this.passwordHash);
};

export const Device = mongoose.model<IDevice>('Device', DeviceSchema);
