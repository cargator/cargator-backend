import mongoose, { Types } from 'mongoose';
import { AdminAction } from '../shared/enums/status.enum';

export interface logActivityDetails {
  ip: String;
  userAgent: String;
  method: String;
  url: String;
  queryParams: String;
  body?: Object | undefined;
}

const LogActivitySchema = new mongoose.Schema(
  {
    admin_id: Types.ObjectId,
    action: {
      type: String,
      enum: AdminAction,
    },
    subject: String,
    details: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
  },
  {
    timestamps: true,
    collection: 'logactivity',
  },
);

export const LogActivity = mongoose.model('LogActivity', LogActivitySchema);
