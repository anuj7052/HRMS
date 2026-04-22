import mongoose, { Document, Schema, Types } from 'mongoose';

export type WFHMode = 'WFH' | 'Field' | 'ClientVisit';
export type WFHRequestStatus = 'Pending' | 'Approved' | 'Rejected';

export interface IWFHRequest extends Document {
  employeeId: Types.ObjectId;
  date: Date;
  mode: WFHMode;
  reason: string;
  status: WFHRequestStatus;
  reviewedBy?: Types.ObjectId;
  reviewedAt?: Date;
  reviewComment?: string;
  createdAt: Date;
  updatedAt: Date;
}

const WFHRequestSchema = new Schema<IWFHRequest>(
  {
    employeeId: { type: Schema.Types.ObjectId, ref: 'Employee', required: true },
    date: { type: Date, required: true },
    mode: { type: String, enum: ['WFH', 'Field', 'ClientVisit'], required: true },
    reason: { type: String, required: true, trim: true },
    status: { type: String, enum: ['Pending', 'Approved', 'Rejected'], default: 'Pending' },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: { type: Date },
    reviewComment: { type: String, trim: true },
  },
  { timestamps: true }
);

WFHRequestSchema.index({ employeeId: 1, date: 1 });
WFHRequestSchema.index({ status: 1 });

export const WFHRequest = mongoose.model<IWFHRequest>('WFHRequest', WFHRequestSchema);
