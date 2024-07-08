import mongoose from "mongoose";

const driverSchema = new mongoose.Schema({
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
}, {
    timestamps: true,
    collection: 'drivers',
},
);
driverSchema.index({ liveLocation: '2d' });

export const Driver = mongoose.model('Driver', driverSchema);