import mongoose, { Types } from 'mongoose';

export type pathCoords = {
  coords: {
    latitude: number;
    longitude: number;
  };
  time: number;
};

const TimelineSchema = new mongoose.Schema(
  {
    driverId: Types.ObjectId,
    orderId: {
      type: Types.ObjectId,
      unique: true,
    },
    pathCoords: {
      type: Array<pathCoords>,
    },
  },
  {
    timestamps: true,
    collection: 'timelines',
  },
);

export const Timeline = mongoose.model('Timeline', TimelineSchema);
