import mongoose, { Types } from 'mongoose';

const placeOrder = new mongoose.Schema(
  {
    order_details: {
      vendor_order_id: { type: String, required: true, unique: true },
      order_total: { type: Number, default: 0 },
      paid: { type: Boolean, required: true },
      order_source: { type: String, required: true },
      customer_orderId: { type: String },
      payment_status: {
        type: Boolean,
        required: true,
      },
    },
    status: { type: String },
    riderPathToPickUp: Array,
    pickupToDrop: Array,
    realPath: Array,
    driver_details: {
      driver_id: String,
      name: String,
      contact: String,
    },
    statusUpdates: [
      {
        status: String,
        location: Array,
        time: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    rideType: String,
    pickup_details: {
      name: { type: String, required: true },
      contact_number: { type: String, required: true },
      latitude: { type: Number, required: true },
      longitude: { type: Number, required: true },
      address: { type: String, required: true },
      city: { type: String, required: true },
    },
    drop_details: {
      name: { type: String, required: true },
      contact_number: { type: String, required: true },
      latitude: { type: Number, required: true },
      longitude: { type: Number, required: true },
      address: { type: String, required: true },
      city: { type: String, required: true },
    },
    order_items: [
      {
        id: String,
        name: { type: String, required: true },
        quantity: { type: Number, required: true },
        price: { type: Number, required: true },
      },
    ],
    foodImageKey: {
      pickUpImageKey: String,
      dropImageKey: String,
      pickUpLocation: {
        latitude: Number,
        longitude: Number,
      },
      dropLocation: {
        latitude: Number,
        longitude: Number,
      },
    },
    travelled_distance: Number,
    ride_income: Number,
  },

  {
    timestamps: true,
  },
);

export const PlaceOrder = mongoose.model('PlaceOrder', placeOrder);
