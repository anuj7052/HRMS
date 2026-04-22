import mongoose, { Document, Schema, Types } from 'mongoose';

export type AttendanceStatus = 'Present' | 'Absent' | 'Late' | 'HalfDay' | 'Leave' | 'Holiday' | 'WeeklyOff';
export type AttendanceMode = 'Office' | 'WFH' | 'Field' | 'ClientVisit';

export interface IGeoPoint {
  lat: number;
  lng: number;
}

export interface IAttendanceLog extends Document {
  employeeId: Types.ObjectId;
  date: Date;
  punchIn?: Date;
  punchOut?: Date;
  workHours?: number;
  status: AttendanceStatus;
  attendanceMode?: AttendanceMode;
  punchInLocation?: IGeoPoint;
  punchOutLocation?: IGeoPoint;
  appPunched?: boolean;
  isRegularized: boolean;
  regularizationReason?: string;
  regularizationStatus?: 'Pending' | 'Approved' | 'Rejected';
  regularizationRequestedAt?: Date;
  deviceId?: Types.ObjectId;
  source?: string;
  createdAt: Date;
  updatedAt: Date;
}

const AttendanceLogSchema = new Schema<IAttendanceLog>(
  {
    employeeId: { type: Schema.Types.ObjectId, ref: 'Employee', required: true },
    date: { type: Date, required: true },
    punchIn: { type: Date },
    punchOut: { type: Date },
    workHours: { type: Number, min: 0 },
    status: {
      type: String,
      enum: ['Present', 'Absent', 'Late', 'HalfDay', 'Leave', 'Holiday', 'WeeklyOff'],
      default: 'Absent',
    },
    attendanceMode: { type: String, enum: ['Office', 'WFH', 'Field', 'ClientVisit'] },
    punchInLocation: {
      lat: { type: Number },
      lng: { type: Number },
    },
    punchOutLocation: {
      lat: { type: Number },
      lng: { type: Number },
    },
    appPunched: { type: Boolean, default: false },
    source: { type: String, default: 'device' }, // 'device' | 'excel-import' | 'manual' | 'app'
    isRegularized: { type: Boolean, default: false },
    regularizationReason: { type: String },
    regularizationStatus: { type: String, enum: ['Pending', 'Approved', 'Rejected'] },
    regularizationRequestedAt: { type: Date },
    deviceId: { type: Schema.Types.ObjectId, ref: 'Device' },
  },
  { timestamps: true }
);

AttendanceLogSchema.index({ employeeId: 1, date: 1 }, { unique: true });
AttendanceLogSchema.index({ date: 1 });
AttendanceLogSchema.index({ status: 1 });

export const AttendanceLog = mongoose.model<IAttendanceLog>('AttendanceLog', AttendanceLogSchema);

// Raw device punch log (before processing)
export interface IRawPunchLog extends Document {
  deviceId: Types.ObjectId;
  employeeDeviceId: string;
  timestamp: Date;
  punchType: number;
  raw: string;
}

const RawPunchLogSchema = new Schema<IRawPunchLog>(
  {
    deviceId: { type: Schema.Types.ObjectId, ref: 'Device', required: true },
    employeeDeviceId: { type: String, required: true },
    timestamp: { type: Date, required: true },
    punchType: { type: Number, default: 0 },
    raw: { type: String },
  },
  { timestamps: true }
);

RawPunchLogSchema.index({ deviceId: 1, employeeDeviceId: 1, timestamp: 1 }, { unique: true });

export const RawPunchLog = mongoose.model<IRawPunchLog>('RawPunchLog', RawPunchLogSchema);
