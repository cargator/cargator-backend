import mongoose, { Types } from 'mongoose';

const restaurant = new mongoose.Schema(
  {
    restaurantName: {
      type: String,
      unique: true,
    },
    restaurantNameToLowerCase: {
      type: String,
      unique: true,
    },
    bounds: [],
  },
  {
    timestamps: true,
    collection: 'restaurants',
  },
);

export const Restaurant = mongoose.model('Restaurant', restaurant);
