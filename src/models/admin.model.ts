import mongoose, { Types } from 'mongoose';
import { AdminRole } from '../shared/enums/status.enum';

const adminSchema = new mongoose.Schema(
  {
    name: String,
    email: {
      type: String,
      unique: true,
    },
    mobile_Number: {
      type: String,
      unique: true,
    },
    password: String,
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
    },
    role: {
      required: false,
      default: AdminRole.ADMIN,
      type: String,
    },
  },
  {
    timestamps: true,
    collection: 'admins',
  },
);

export const Admin = mongoose.model('Admin', adminSchema);
