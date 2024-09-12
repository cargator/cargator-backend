import mongoose, { Types } from 'mongoose';

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
    forGroundIntervalDuration: Number,
    currentMap: String,
    appImageKey: String,
  },
  {
    timestamps: true,
    collection: 'utils',
  },
);

const vehicleTypeSchema = new mongoose.Schema(
  {
    vehicleType: String,
    vehicleModel: String,
    vehicleMake: String,
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

const spots = new mongoose.Schema(
  {
    spotName: {
      type: String,
      unique: true,
    },
    vehicleNumber: String,
    bounds: [],
  },
  {
    timestamps: true,
    collection: 'spots',
  },
);
// country code schema

const countryCodeSchema = new mongoose.Schema(
  {
    countryCode: String,
    countryName: String,
  },
  {
    timestamps: true,
    collection: 'countryCodes',
  },
);

// flows point schema
const breakingPointSchema = new mongoose.Schema(
  {
    breakingPointName: String,
    sequenceNo: Number,
  },
  {
    timestamps: true,
    collection: 'flows',
  },
);

// Application flow driver

const driverApplicationFlow = new mongoose.Schema(
  {
    applicationFLow: String,
  },
  {
    timestamps: true,
    collection: 'driverAppFlow',
  },
);

// Order Schema's

export const VehicleTypes = mongoose.model('vehicleTypes', vehicleTypeSchema);
export const fares = mongoose.model('fares', faresSchema);
export const apps = mongoose.model('apps', appsSchema);
export const Spots = mongoose.model('Spots', spots);
export const Utils = mongoose.model('Utils', utilsSchema);
export const Vehicles = mongoose.model('vehicles', vehicleSchema);
export const CountryCode = mongoose.model('CountryCode', countryCodeSchema);
export const Flows = mongoose.model('Flows', breakingPointSchema);
export const DriverAppFlow = mongoose.model(
  'DriverAppFlow',
  driverApplicationFlow,
);
