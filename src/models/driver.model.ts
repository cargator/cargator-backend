import mongoose, { Types } from 'mongoose';

const loginSessionSchema = new mongoose.Schema({
  loginTime: Date,
  logoutTime: Date,
});

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
    restaurentName: String,
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
    deviceInfo: {
      versionNumber: String,
      deviceModel: String,
      deviceBrand: String,
      systemName: String,
      systemVersion: String,
      batteryLevel: String,
    },
    loginSessions: [loginSessionSchema],
    otp: String,
    otpExpirationTime: Date,
    totalRidesCompleted: { type: Number, default: 0 },
    deviceToken: String,
  },
  {
    timestamps: true,
    collection: 'drivers',
  },
);
driverSchema.index({ liveLocation: '2d' });

export const Driver = mongoose.model('Driver', driverSchema);
