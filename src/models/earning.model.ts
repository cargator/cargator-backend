import mongoose, { Types } from 'mongoose';

const earning = new mongoose.Schema(
  {
    earning: { type: String, required: true },
    km: { type: Number, required: true },
    orderId: { type: String, required: true },
    driverId: { type: String, required: true },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

export const Earning = mongoose.model('Earning', earning);
