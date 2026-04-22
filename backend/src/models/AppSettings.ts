import mongoose, { Document, Schema } from 'mongoose';

export interface IHoliday {
  name: string;
  date: Date;
}

export interface IAppSettings extends Document {
  allowedEmailDomains: string[];
  shiftStart: string; // "09:00"
  shiftEnd: string;   // "18:00"
  lateThresholdMinutes: number;
  halfDayThresholdHours: number;
  workingDays: string[]; // ["Mon","Tue","Wed","Thu","Fri"]
  holidays: IHoliday[];
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass: string;
  smtpFrom: string;
  emailNotificationsEnabled: boolean;
}

const HolidaySchema = new Schema<IHoliday>(
  {
    name: { type: String, required: true },
    date: { type: Date, required: true },
  },
  { _id: false }
);

const AppSettingsSchema = new Schema<IAppSettings>(
  {
    allowedEmailDomains: { type: [String], default: [] },
    shiftStart: { type: String, default: '09:00' },
    shiftEnd: { type: String, default: '18:00' },
    lateThresholdMinutes: { type: Number, default: 15 },
    halfDayThresholdHours: { type: Number, default: 4 },
    workingDays: { type: [String], default: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] },
    holidays: { type: [HolidaySchema], default: [] },
    smtpHost: { type: String, default: '' },
    smtpPort: { type: Number, default: 587 },
    smtpUser: { type: String, default: '' },
    smtpPass: { type: String, default: '', select: false },
    smtpFrom: { type: String, default: '' },
    emailNotificationsEnabled: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const AppSettings = mongoose.model<IAppSettings>('AppSettings', AppSettingsSchema);
