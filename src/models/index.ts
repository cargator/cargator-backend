// import { Vehicles } from './index';
import mongoose, { Types } from 'mongoose';

const adminSchema = new mongoose.Schema(
  {
    name: String,
    email: {
      type: String,
      unique: true,
    },
    password: String,
  },
  {
    timestamps: true,
    collection: 'admins',
  },
);

const driverSchema = new mongoose.Schema(
  {
    // todo: geolocation index
    liveLocation: Array,
    mobileNumber: {
      type: String,
      unique: true,
    },
    driverId: String,
    firstName: String,
    lastName: String,
    email: String,
    profileImageKey: String,
    documentsKey: Array,
    vehicleName: String,
    vehicleNumber: String,
    vehicleType: String,
    rideStatus: {
      type: String,
      enum: ['offline', 'online', 'on-ride'],
      default: 'offline',
    },
    // admin can make driver active or inactive
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
    },
    otp: String,
    otpExpirationTime: Date,
    totalRidesCompleted: { type: Number, default: 0 },
  },
  {
    timestamps: true,
    collection: 'drivers',
  },
);
driverSchema.index({ liveLocation: '2d' });

const locations = new mongoose.Schema(
  {
    text: { type: String, unique: true },
    predictions: Array,
    expireAt: { type: Date, default: Date.now() + 7 * 24 * 60 * 60 * 1000 }, // expires in 7 days
  },
  {
    timestamps: true,
    collection: 'locations',
  },
);

const locationsmapmy = new mongoose.Schema(
  {
    text: { type: String, unique: true },
    predictions: Array,
    expireAt: { type: Date, default: Date.now() + 7 * 24 * 60 * 60 * 1000 }, // expires in 7 days
  },
  {
    timestamps: true,
    collection: 'locationsmapmy',
  },
);

const addresslatlongSchema = new mongoose.Schema(
  {
    address: { type: String, unique: true },
    latlong: Array,
    expireAt: { type: Date, default: Date.now() + 7 * 24 * 60 * 60 * 1000 }, // expires in 7 days
  },
  {
    timestamps: true,
    collection: 'addresslatlong',
  },
);
addresslatlongSchema.index({ latlong: '2d' });

const addresslatlongSchemamapmy = new mongoose.Schema(
  {
    address: { type: String, unique: true },
    latlong: [],
    expireAt: { type: Date, default: Date.now() + 7 * 24 * 60 * 60 * 1000 }, // expires in 7 days
  },
  {
    timestamps: true,
    collection: 'addresslatlongmapmy',
  },
);
addresslatlongSchemamapmy.index({ latlong: '2d' });

const ridesSchema = new mongoose.Schema(
  {
    riderId: { type: Types.ObjectId, index: true },
    pickUpLocation: Array,
    dropLocation: Array,
    pickUpAddress: String,
    platform: String,
    cancelBy: Object,
    dropAddress: String,
    distance: String,
    duration: String,
    status: {
      type: String,
      enum: [
        'pending-accept',
        'pending-arrival',
        'pending-otp',
        'ride-started',
        'pending-payment',
        'payment-failed',
        'completed',
        'cancelled',
        'Failed'
      ],
    },
    otp: String,
    // message: String,
    // driverLocation: Array,
    driverId: { type: mongoose.Schema.Types.ObjectId, index: true },
    vehicleNumber: String,
    driverDistanceToPickUp: Object,
    driverDurationToPickUp: Object,
    driverPathToPickUp: Array,
    pickupToDropPath: Array,
    fare: Number,
    realPath: Array,
    paymentMode: String,
    chatMessages: Array,
    driverUnreadMessagesCount: { type: Number, default: 0 },
    riderUnreadMessagesCount: { type: Number, default: 0 },
    bookingTime: Date,
  },
  {
    timestamps: true,
    collection: 'rides',
  },
);
ridesSchema.index({ pickUpLocation: '2d' });

const ridersSchema = new mongoose.Schema(
  {
    name: String,
    mobileNumber: {
      type: String,
      unique: true,
      require: true,
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
    },
    otp: String,
    otpExpirationTime: Date,
    totalRidesCompleted: { type: Number, default: 0 },
  },
  {
    timestamps: true,
    collection: 'riders',
  },
);

const vehicleSchema = new mongoose.Schema(
  {
    vehicleName: String,
    vehicleNumber: {
      type: String,
      unique: true,
    },
    vehicleMake: String,
    vehicleModel: String,
    vehicleType: {
      type: String,
    },
    vehicleStatus: {
      type: String,
      enum: ['available', 'unavailable'],
      default: 'available',
    },
    vehicleAssignedToId: {
      type: String,
      default: 'NA',
    },
    profileImageKey: String,
    documentsKey: Array,
  },
  {
    timestamps: true,
    collection: 'vehicles',
  },
);

const utilsSchema = new mongoose.Schema(
  {
    georange: String,
    nearbyDriversDistanceInKm: Number,
    baseFare: Number,
    debounceTime: Number,
    preBookRideTime: Number,
    scheduleRideInterval: Number,
  },
  {
    timestamps: true,
    collection: 'utils',
  },
);

const orderSchema = new mongoose.Schema(
  {
    user_id: String,
    mobileNumber: String,
    order_id: {
      type: String,
      unique: true,
    },
    status: String,
    razorpay_payment_id: Array,
    amount: Number,
    amount_paid: Number,
    amount_due: Number,
    currency: {
      type: String,
      default: 'INR',
    },
    offer_id: String,
    attempts: {
      type: Number,
      default: 0,
    },
    notes: Array,
    description: String,
  },
  {
    timestamps: true,
    collection: 'orders',
  },
);

const paymentSchema = new mongoose.Schema(
  {
    entity: String,
    account_id: String,
    event: String,
    event_id: String,
    contains: Array,
    user_id: String,
    payload: Object,
  },
  {
    timestamps: true,
    collection: 'payments',
  },
);
paymentSchema.index({ 'payload.status': 1, 'payload.id': 1 }, { unique: true });

const whatsappChatSchema = new mongoose.Schema(
  {
    riderId: { type: Types.ObjectId, index: true },
    mobileNumber : String,
    pickUpLocation: Array,
    dropLocation: Array,
    pickAddress: String,
    dropAddress: String,
    flowType:String,
    make:String,
    model:String,
    oxygenCylinder:String,
  },
  {
    timestamps: true,
    collection: 'whatsappChats',
  },
);
whatsappChatSchema.index({ pickUpLocation: '2d' });

const vehicleTypeSchema = new mongoose.Schema(
  {
    vehicleType: String,
    vehicleModel: String,
    vehicleMake: String
  },
  {
    timestamps: true,
    collection: 'vehicleTypes',
  },
);

const faresSchema = new mongoose.Schema(
  {
    fare: String,
  },
  {
    timestamps: true,
    collection: 'fares',
  },
);

const appsSchema = new mongoose.Schema(
  {
    name: String,
    profileImageKey: String,
  },
  {
    timestamps: true,
    collection: 'apps',
  },
);


export const Admin = mongoose.model('Admin', adminSchema);
export const VehicleTypes = mongoose.model('vehicleTypes', vehicleTypeSchema);
export const fares = mongoose.model('fares', faresSchema);
export const apps = mongoose.model('apps', appsSchema);
export const Driver = mongoose.model('Driver', driverSchema);
export const Riders = mongoose.model('Riders', ridersSchema);
export const Utils = mongoose.model('Utils', utilsSchema);
export const Rides = mongoose.model('Rides', ridesSchema);
export const locationList = mongoose.model('locations', locations);
export const locationListmapmyindia = mongoose.model(
  'locationsmapmy',
  locationsmapmy,
);
export const Orders = mongoose.model('orders', orderSchema);
export const Payments = mongoose.model('payments', paymentSchema);
export const whatsappChats = mongoose.model(
  'whatsappChats',
  whatsappChatSchema,
);
export const Vehicles = mongoose.model('vehicles', vehicleSchema);
export const addressLatlong = mongoose.model(
  'addresslatlong',
  addresslatlongSchema,
);
export const addressLatlongmapyindia = mongoose.model(
  'addressLatlongmapyindia',
  addresslatlongSchemamapmy,
);
