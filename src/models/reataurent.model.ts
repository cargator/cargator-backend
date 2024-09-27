import mongoose, { Types } from 'mongoose';

const restaurent = new mongoose.Schema(
  {
    restaurentName: {
      type: String,
      unique: true,
    },
    restaurentNameToLowerCase: {
      type: String,
      unique: true,
    },
    bounds: [],
  },
  {
    timestamps: true,
    collection: 'restaurents',
  },
);

export const Restaurent = mongoose.model('Restaurent', restaurent);
