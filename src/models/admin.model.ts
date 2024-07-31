import mongoose, { Types } from 'mongoose';

const adminSchema = new mongoose.Schema(
  {
    name: String,
    email: {
      type: String,
      unique: true,
    },
    mobile_Number:{
      type:String,
      unique:true
    },
    password: String,

  },
  {
    timestamps: true,
    collection: 'admins',
  },
);

export const Admin = mongoose.model('Admin', adminSchema);