'use strict';

// Library Imports
import { instrument } from '@socket.io/admin-ui';
import { createAdapter } from '@socket.io/redis-adapter';
import cors from 'cors';
import express, { Request, Response, json } from 'express';
import { createClient } from 'redis';
import { Server, Socket } from 'socket.io';
import environmentVars from './constantsVars'
import { Types } from 'mongoose';
// Files Imports
import mongoConnect from './config/mongo';
import constants from './constantsVars';
import { formatSocketResponse } from './helpers/common';
import driverSocketConnected, { getDriverSocket } from './helpers/driverEvents';
import riderSocketConnected, { getRiderSocket } from './helpers/riderEvents';
import {
  adminLogin,
  adminRegister,
  changePassword,
  dashboardData,
  rideAssignedByAdmin,
} from './main/admin';
import { handleLogin, verifyOtp } from './main/auth';
import { chatGptApi } from './main/chatGpt';
import {
  allActiveDrivers,
  createDriver,
  deleteDriver,
  getDriverById,
  getDriverLocations,
  nearBydriver,
  onlineDrivers,
  paginatedDriverData,
  searchDrivers,
  updateDriver,
  updateDriverStatus,
} from './main/driver';
import {
  addressFromCoordinates,
  addressFromCoordinatesmapmyindia,
  coordinatesFromAddress,
  getAddressFromAutocomplete,
  getAddressFromAutocompleteOlaMaps,
  // getAddressFromAutocompletemapmyindia,
  getDirection,
  getDirectionmapmyindia,
} from './main/map';
import {
  cancelOrder,
  createOrder,
  getFare,
  razorPayCallback,
} from './main/payment';
import {
  cancelScheduledRide,
  createCustomRides,
  getAllRide,
  getAllScheduleRides,
  getCurrentRide,
  getRideDetail,
  getRideHistory,
  getRidesByFilters,
  searchRide,
  updateRides,
} from './main/ride';
import {
  addProfileDetails,
  deleteRider,
  getAllRiders,
  getRiderById,
  searchRidersByName,
  updateRiderStatus,
} from './main/rider';
import {
  allAllVehicles,
  allAvailableVehicles,
  createVehicleData,
  deleteVehicle,
  getVehicleById,
  getVehicleData,
  paginatedVehicleData,
  searchVehicles,
  updateVehicle,
} from './main/vehiclesDetails';
import { Driver, Orders, Payments, PlaceOrder, Rides, TrackOrderStatus, Utils, Vehicles } from './models';
import axios from 'axios';
import { handleWebhookPost, handleWebhookVerification } from './main/whatsAppChat';
import { createVehicleType, deleteVehicleType, getVehicleOne, getVehicleType, updateVehicleType } from './main/vehicleType';
import { createFare, getFareValue, upDateFareValue } from './main/fare';
import { createApp, createDriverAppFlow, getAppFlow, getAppFlowMobile, getAppValue, upDateAppValue, updateAppFlow } from './main/app';
import { createSpot, deleteSpot, getActiveSpot, getSpotList, getSpotListVehicle } from './main/spots';
import { createCountryCode, deleteCountryCode, getCountryCodeMobiles, getCountryCodes } from './main/countrycode';
import { createBreakPoints, deleteBreakingPoints, getBreakPointOne, getBreakingPoints, getBreakingPointsMobile, updateBreakPoints } from './main/flows';
import { cancelTask, getHistory, getProgress, orderAccept, orderUpdate, placeOrder, trackOrderStatus } from './main/order';
import { OrderStatusEnum } from './shared/enums/status.enum';

let utilsData: any;

const AWS = require('aws-sdk');
const _ = require('lodash');
const jwt = require('jsonwebtoken');
const app = express();
const crypto = require('crypto');
const Razorpay = require('razorpay');
const cron = require('node-cron');
const CronJob = require('cron').CronJob;


AWS.config.update({
  region: environmentVars.AWS_REGION,
  accessKeyId: environmentVars.AWS_ACCESS_KEY_ID,
  secretAccessKey: environmentVars.AWS_SECRET_ACCESS_KEY,
});

// Function to add available drivers to a ride room and notify them about a new ride request
const addDriversToRoom: any = (data: any) => {
  const { ride, drivers } = JSON.parse(data);
  drivers.forEach((driver: any) => {
    let tempDriverId = driver._id.toString();
    const driversSocket = getDriverSocket(tempDriverId);
    if (driversSocket) {
      driversSocket.join(`${ride._id.toString()}-ride-room-pre`);
      driversSocket.emit('ride-request', formatSocketResponse([ride]));
      // driversSocket.emit('reached-pickup');
    }
  });
  console.log('all drivers added to room');
};

const sendOrderToDriverRoom: any = (data: any) => {
  try {
    const { newOrder, drivers } = JSON.parse(data);
  drivers.forEach((driver: any) => {
    let tempDriverId = driver._id.toString();
    const driversSocket = getDriverSocket(tempDriverId);
    if (driversSocket) {
      driversSocket.join(`${newOrder._id.toString()}-ride-room-pre`);
      driversSocket.emit('order-request', [newOrder]);
    }
  });
  console.log('all drivers added to room');
  } catch (error: any) {
    console.log("error :", error);
  }
}

// Function to add the rider to a ride room and update their ride status
const addRiderToRoom: any = (data: any) => {
  const updatedRide = JSON.parse(data);
  const riderSockets = getRiderSocket(updatedRide.riderId);
  if (riderSockets) {
    riderSockets.emit(
      'ride-status',
      formatSocketResponse({ data: updatedRide }),
    );
    riderSockets.join(`${updatedRide._id.toString()}-ride-room`);
    console.log('ride-status sent to ', updatedRide.riderId);
  } else {
    console.log('addRiderToRoom :>> riderSocket not found!');
  }
};

const addRiderToRoomForScheduled = (data: any) => {
  const ride = JSON.parse(data);
  const riderSockets = getRiderSocket(ride.riderId);
  if (riderSockets) {
    riderSockets.join(`${ride._id.toString()}-ride-room-pre`);
    riderSockets.emit(
      'ride-request-response',
      formatSocketResponse({
        message: 'Ride requested',
        data: ride,
      }),
    );
    console.log('ride-status sent to ', ride.riderId);
  } else {
    console.log('addRiderToRoomForScheduled :>> riderSocket not found!');
  }
};
const cancelScheduledRideCron: any = async (data: any) => {
  const updatedRide = JSON.parse(data);
  const riderSocket = getRiderSocket(updatedRide.riderId);

  if (riderSocket) {
    await riderSocket.join(`${updatedRide._id.toString()}-ride-room-pre`);

    io.to(`${updatedRide._id.toString()}-ride-room-pre`).emit(
      'cancel-ride',
      formatSocketResponse({
        message: `Cancelled scheduled-ride as no drivers found!`,
        rideId: updatedRide._id,
      }),
    );
    //! check if this below statement is deleting room or not.
    io.in(`${updatedRide._id}-ride-room-pre`).socketsLeave(
      `${updatedRide._id}-ride-room-pre`,
    );
  } else {
    console.log('cancelScheduledRideCron :>> riderSocket not found!');
  }
};

let io: Server;

// Configure Express app with necessary middleware
app.use(cors());
app.use(json());
const razorpay = new Razorpay({
  key_id: environmentVars.DEV_RAZORPAY_KEY_ID
    ? environmentVars.DEV_RAZORPAY_KEY_ID
    : '',
  key_secret: environmentVars.DEV_RAZORPAY_KEY_SECRET
    ? environmentVars.DEV_RAZORPAY_KEY_SECRET
    : '',
});

let access_token = '';
const refreshToken = async () => {
  try {
    // Make a request to obtain a new token (assuming you have the necessary API endpoint)
    const data = {
      grant_type: 'client_credentials',
      client_id: `${environmentVars.REFRESH_TOKEN_CLIENT_ID}`,
      client_secret: `${environmentVars.REFRESH_TOKEN_CLIENT_SECRET}`,
    };

    const token: any = await axios.post(
      `${environmentVars.REFRESH_TOKEN_URL}`,
      data,
      {
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
      },
    );
    if (!token) {
      throw new Error('Token is not generated due to server error');
    }
    // console.log('token', token)
    access_token = token.data.access_token;
    console.log('Token for MapMyIndia refreshed successfully:', access_token);
  } catch (error) {
    console.error('Token refresh failed:', error);
  }
};
// let flag = false;
async function setUpCronJobs() {
  try {
    // if (flag) {
    //   return;
    // }
    // flag = true;
    utilsData = await Utils.findOne({ _id: '64c8b0909850db70747e62b9' });
    if (!utilsData) {
      utilsData = {
        georange: '0.015',
        nearbyDriversDistanceInKm: 5,
        baseFare: 15,
        debounceTime: 500,
      };
    }
    await refreshToken();
    // Define your cron job schedule (runs every 15 minutes)
    const cronExpression = '0 */15 * * * *';

    // Create a new cron job
    const job = new CronJob(cronExpression, async () => {
      // This function will be executed when the cron job runs every 15 minutes
      try {
        console.log('Cron job executed at:', new Date());

        utilsData = await Utils.findOne({ _id: '64c8b0909850db70747e62b9' });
      } catch {
        utilsData = {
          georange: '0.015',
          nearbyDriversDistanceInKm: 5,
          baseFare: 15,
          debounceTime: 500,
          preBookRideTime: 20,
          scheduleRideInterval: 5,
        };
      }
    });

    // Start the cron job
    job.start();

    //  console.log('access_token', access_token)
    // Schedule the cron job to run every 23 hours (or any desired interval)
    cron.schedule('0 0 */23 * * *', () => {
      // This cron job will run every 23 hours (adjust as needed).
      // You can change the timing or interval based on your requirements.
      // Call the refreshToken function to update the token
      refreshToken();
    });

    cron.schedule('*/105 * * * * *', function () {
      // cron.schedule('*/15 * * * * *', function () {
      console.log('Checking pre-book rides every minute !');
      // console.log('Checking pre-book rides every 15 seconds !');
      checkPreBookRides();
      checkOrders(undefined);
    });
  } catch (err) {
    console.log('err', err);
  }
}

const checkPreBookRides = async () => {
  try {
    let utilsData = getUtils();
    let startDate: any = new Date();
    let endDate: any = new Date();
    //! confirm if this below statement is changing hour in corner cases.
    endDate.setMinutes(endDate.getMinutes() + utilsData.preBookRideTime);
    // console.log({ startDate, endDate });

    let preBookedRides: any = await Rides.find({
      status: 'pending-accept',
      bookingTime: {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      },
    });

    for (const ride of preBookedRides) {
      const bookingTime: any = new Date(ride.bookingTime);
      const minutesTillBookingTime = (bookingTime - startDate) / (60 * 1000);

      // let preBookTime = bookingTime.getMinutes();
      // console.log({ bookingTime, minutesTillBookingTime });
      // console.log(`ELSE Condition :>> `, Math.round(minutesTillBookingTime % utilsData.scheduleRideInterval))

      // Cancel currrent Scheduled-Ride if not accepted by any driver in last 10-minutes of 'bookingTime'.
      // if (endDate.getMinutes() - bookingTime.getMinutes() <= 10) {
      if (minutesTillBookingTime <= 10) {
        const updatedRide: any = await Rides.findByIdAndUpdate(
          ride._id,
          {
            status: 'cancelled',
            cancelBy: {
              // id: ride.riderId,
              // type: 'rider',
              reason: 'No drivers found for scheduled-ride',
            },
          },
          { new: true },
        );

        if (!updatedRide) {
          throw new Error(
            'Ride document not found while cancelling scheduled-ride by cron!',
          );
        }

        console.log(
          'Cancelled Scheduled-Ride as not accepted by any driver in last 10-minutes of bookingTime',
        );

        await pubClient.publish(
          'cancel-scheduled-ride-cron',
          formatSocketResponse(updatedRide),
        );

        // console.log('cancel ride event emitting ');
        // } else if ((preBookTime - startDate.getMinutes()) % utilsData.scheduleRideInterval === 0) {
        // } else {
      } else if (
        Math.round(minutesTillBookingTime % utilsData.scheduleRideInterval) == 0
      ) {
        // Find available drivers for the new ride within a certain radius
        const nearbyDriversDistanceInKm: any = await Utils.findOne({
          _id: '64c8b0909850db70747e62b9',
        });

        const nearbyDriversDistanceInRadians =
          nearbyDriversDistanceInKm.nearbyDriversDistanceInKm / 111.12; // Note: One degree is approximately 111.12 kilometers.

        // find drivers available to accept new ride
        const availableDrivers = await Driver.find({
          rideStatus: 'online', // is acceptingRides(online) or not (offline)
          status: 'active', // drivers current ride status i.e if on a ride(on-ride) or free(active)
          liveLocation: {
            // $near: [72.9656312, 19.1649861],
            $near: [ride.pickUpLocation[1], ride.pickUpLocation[0]],
            $maxDistance: nearbyDriversDistanceInRadians,
          },
        })
          .limit(20)
          .lean();

        // console.log(`checkPreBookRides availableDrivers :>> `, availableDrivers);
        const data = { ride, drivers: availableDrivers };

        // Publish a message to join available drivers to a room
        pubClient.publish(
          'join-availableDrivers-to-room',
          formatSocketResponse(data),
        );
        pubClient.publish(
          'join-rider-to-room-for-scheduled-ride',
          formatSocketResponse(ride),
        );
      }
    }
  } catch (error: any) {
    console.log('checkPreBookRides error', error?.message);
  }
};

export const checkOrders = async (newOrder: any) => {
  try {
    let endDate: any = new Date();
    endDate.setMinutes(endDate.getMinutes() - 10);

    if (newOrder === undefined) {
      let orders: any = await PlaceOrder.find({
        createdAt: {
          $gte: endDate
        },
        status: OrderStatusEnum.ORDER_ACCEPTED
      });

      for (const newOrder of orders) {

        // find drivers available to accept new ride
        const availableDrivers = await Driver.find({
          rideStatus: 'online',
          status: 'active',
        }).limit(20).lean();

        // console.log(`checkPreBookRides availableDrivers :>> `, availableDrivers);
        const data = { newOrder, drivers: availableDrivers };

        pubClient.publish(
          'join-drivers-to-orders',
          formatSocketResponse(data),
        );
      }
    }
    else {
      const availableDrivers = await Driver.find({
        rideStatus: 'online',
        status: 'active',
      }).limit(20).lean();

      // console.log(`checkPreBookRides availableDrivers :>> `, availableDrivers);
      const data = { newOrder, drivers: availableDrivers };

      pubClient.publish(
        'join-drivers-to-orders',
        formatSocketResponse(data),
      );
    }

  } catch (error: any) {
    console.log("Error while check orders", error.message);
  }
}

// container health check endpoint
app.get('/', (req: Request, res: Response) => {
  res.send('success');
});

//whatsAppChatBot

app.get('/webhook', handleWebhookVerification)

app.post('/webhook', handleWebhookPost);

// Middleware function to authorize requests with a JWT token
const authorize = async (req: any, res: Response, next: any) => {
  try {
    const token = req?.headers?.authorization?.split(' ')[1];
    if (token) {
      // Verify the JWT token
      jwt.verify(token, environmentVars.PUBLIC_KEY, (err: any, decoded: any) => {
        if (err) {
          throw new Error('Invalid token');
          // res.status(401).send({ message: 'Token invalid' });
          // res.json({ success: false, message: "Token invalid" }); // Token has expired or is invalid
        } else {
          req.decoded = decoded; // Assign to req. variable to be able to use it in next() route ('/me' route)
          next(); // Required to leave middleware
        }
      });
    } else {
      res.status(401).send({ success: false, message: 'No token provided' }); // Return error if no token was provided in the request
    }
  } catch (error: any) {
    return res.status(403).send({ message: error.message });
  }
};

const decodeToken = (token: any) => {
  try {
    const data = jwt.verify(token, environmentVars.PUBLIC_KEY);
    // return JSON.parse(data);
    return data
  } catch (error) {
    return false;
  }
};

// Route for user login with OTP generation
app.post('/login', handleLogin);
app.get('/getCountryCodeMobile', getCountryCodeMobiles);
// Route for verifying OTP and generating authentication token
app.post('/verifyOtp', verifyOtp);

app.get('/debounceTimeApi', async (req: Request, res: Response) => {
  try {
    const debounceTime = getUtils();
    return res.send({ data: debounceTime });
  } catch (error: any) {
    console.log('Debounce Time error', error);
    res.status(400).send({ error: error?.message });
  }
});

app.post('/razorPayCallback', (req, res) => {
  razorPayCallback(req, res, io);
});

app.post('/presignedurl', async (req, res) => {
  try {
    const { key, contentType, type } = req.body;

    const s3 = new AWS.S3();
    let s3Params;
    if (type == 'put') {
      s3Params = {
        Bucket: 'cargator',
        Key: key,
        Expires: 60 * 60,
        ContentType: contentType,
      };
    } else {
      s3Params = {
        Bucket: 'cargator',
        Key: key,
        Expires: 60 * 60,
        // ContentType: contentType,
      };
    }

    // const url = await getPresignUrlPromiseFunction(s3, s3Params);
    const url = await s3.getSignedUrl(
      type == 'put' ? 'putObject' : 'getObject',
      s3Params,
    );
    if (!url) {
      throw new Error('URL not generated');
    }
    // console.log('object url :>> ', url);
    if (url) {
      res.status(200).send({
        message: 'URL recieved successfully',
        url: url,
      });
    }
  } catch (error: any) {
    console.log('presignedurl error: ', error);
    res.status(400).send({ error: error.message });
  }
});

// Route for admin login
app.post('/admin-login', adminLogin);

// Route for admin register
app.post('/admin-register', adminRegister);


// Order API's--------------------

app.post("/place-order", placeOrder);

app.put("/track-order-status", trackOrderStatus)

app.put("/cancel-task", cancelTask)

app.get("/getAppFlowMobile", getAppFlowMobile);

app.use(authorize);

app.post("/get-history", getHistory);
app.get("/progress", getProgress);

// app.get("/get-new-orders", getNewOrders)

app.post('/order-accept', orderAccept)

app.post('/order-update', orderUpdate)

app.post('/add-profile-details', addProfileDetails);

if (environmentVars.MAP_MY_INDIA == 'false') {

  // Route for fetching address predictions from Google Places Autocomplete API
  app.post('/get-address-from-autocomplete', getAddressFromAutocomplete);

  app.post('/get-directions', getDirection);
  // Route for fetching address from coordinates using Google Geocoding API
  app.post('/get-address-from-coordinates', addressFromCoordinates);

  // Route for fetching coordinates from address using Google Geocoding API
  app.post('/get-coordinates-from-address', coordinatesFromAddress);
} else {

  app.post(
    '/get-address-from-autocomplete',
    getAddressFromAutocompleteOlaMaps,
  );

  // app.post(
  //   '/get-address-from-autocomplete',
  //   getAddressFromAutocompletemapmyindia,
  // );
  // app.post('/get-address-from-autocomplete', getAddressFromAutocomplete);

  app.post('/get-address-from-coordinates', addressFromCoordinates);
  // app.post('/get-address-from-coordinates', addressFromCoordinatesmapmyindia);


  app.post('/get-directions', getDirectionmapmyindia);

  app.post('/get-coordinates-from-address', coordinatesFromAddress);
}
// Route for fetching distance and calculate the fair
app.post('/get-fare', getFare);

// Route for fetching directions between two locations using a map service

app.get('/get-current-rides', getCurrentRide);

app.get('/get-all-rides', getAllRide);

app.get('/get-all-riders', getAllRiders);

app.get('/get-ride-details/:id', getRideDetail);

app.post('/createOrder', createOrder);

app.post('/cancelOrder', cancelOrder);

// app.get('/fetchPendingPayments', async (req: Request, res: Response) => {
//   FetchPayments();
// res.sendStatus(200);
// });

app.post('/get-driver-location', getDriverLocations);

//pagination api for driver data

// driver crud

app.delete('/deleteDriver/:uid', deleteDriver);

app.get('/getDriverById/:id', getDriverById);

app.post('/getRideHistory/:id', getRideHistory);

// vehicle crud

app.delete('/deleteVehicle/:uid', deleteVehicle);

// Route for admin change password
app.post('/change-password', changePassword);

app.get('/dashboard-data', dashboardData);

const FetchPayments = async () => {
  let session: any;
  try {
    const response: any = await Orders.find({ status: 'created' });
    if (response.length == 0) {
      throw new Error('No pending records');
    }
    session = await Orders.startSession();
    await session.startTransaction();

    await Promise.all(
      response.map(async (resp: any) => {
        const checkPayment: any = await Payments.find({
          'payload.order_id': resp['order_id'],
        });
        if (checkPayment.length > 0) {
          let existingStatus: any = [];
          await Promise.all(
            checkPayment.map((data: any) => {
              existingStatus.push(data.payload.status);
            }),
          );
          let addPayments = false;
          if (checkPayment?.status == 'refunded') {
            addPayments = true;
          }
          if (!addPayments) {
            //Payments can be fetched through OrderId and PaymentId

            const PaymentsData: any = await razorpay.orders.fetchPayments(
              resp['order_id'],
            );
            //Below are the status of payments
            await Promise.all(
              PaymentsData.items.map(async (data: any) => {
                console.log('data.status', data.status);
                if (!existingStatus.includes(data.status)) {
                  // console.log('first', resp['order_id'], ' ', resp['user_id']);
                  const modifiedData = {
                    event: `payment.${data.status}`,
                    event_id: null,
                    contains: [],
                    user_id: resp['user_id'],
                    payload: data,
                  };
                  await Payments.create([modifiedData], { session });
                  const status = data.status == 'failed' ? 'failed' : 'paid'; //The order continues to be in the paid state even if the payment associated with the order is refunded.

                  const test = await Orders.findOneAndUpdate(
                    { order_id: resp.order_id, status: 'created' },
                    // { status:status,razorpay_payment_id:modifiedData.payload.id},           //The order continues to be in the paid state even if the payment associated with the order is refunded.
                    {
                      status,
                      $addToSet: {
                        razorpay_payment_id: modifiedData.payload.id,
                      },
                    },
                    { new: true, session },
                  );
                }
              }),
            );
          }
          existingStatus = [];
          addPayments = false;
        } else {
          const PaymentsData: any = await razorpay.orders.fetchPayments(
            resp['order_id'],
          );
          if (PaymentsData) {
            await Promise.all(
              PaymentsData.items.map(async (data: any) => {
                const modifiedData = {
                  event: `payment.${data.status}`,
                  event_id: null,
                  contains: [],
                  user_id: resp['user_id'],
                  payload: data,
                };
                await Payments.create([modifiedData], { session });
                const status = data.status == 'failed' ? 'failed' : 'paid'; //The order continues to be in the paid state even if the payment associated with the order is refunded.

                const test = await Orders.findOneAndUpdate(
                  { order_id: resp.order_id, status: 'created' },
                  // { status:status,razorpay_payment_id:modifiedData.payload.id},   //The order continues to be in the paid state even if the payment associated with the order is refunded.
                  {
                    status,
                    $addToSet: {
                      razorpay_payment_id: modifiedData.payload.id,
                    },
                  },
                  { new: true, session },
                );
              }),
            );
          }
        }
      }),
    );
    await session.commitTransaction();
  } catch (error: any) {
    console.log('error in FetchPayments', error);
    if (session) {
      await session.abortTransaction();
    }
  } finally {
    if (session) {
      await session.endSession();
    }
  }
};

//s3
// function getPresignUrlPromiseFunction(s3:any, s3Params:object): Promise<string>{
//     return new Promise(async (resolve, reject) => {
//     try {
//         await s3.getSignedUrl('putObject', s3Params, function (err:any, data:any) {
//     if (err) {
//     return reject(err);
//     }
//     resolve(data);
//   });
// } catch (error) {
//     return reject(error);
//     }
//   });
// }

// const getPresignUrlPromiseFunction = async (s3:any, s3Params:object)=>{
//   try {
//     const preSignedUrl = await s3.getSignedUrl('putObject', s3Params)
//     if(preSignedUrl){
//       return preSignedUrl;
//     }else{
//       return new Error('URL not generated')
//     }
//   } catch (error) {
//     return new Error('something went wrong');
//   }
// }

app.get('/get-all-scheduled-rides/:riderId', getAllScheduleRides);

//pagination api for driver data

app.post('/delete-object-from-s3', async (req, res) => {
  try {
    const { key } = req.body;
    const s3 = new AWS.S3();
    const params = {
      Bucket: 'cargator',
      Key: key, // Replace with the key of the object you want to delete
    };

    s3.deleteObject(params, (err: any, data: any) => {
      if (err) {
        console.error('Error deleting object:', err);
        res.status(400).json({ success: false, message: err });
      } else {
        // console.log("Object deleted successfully");
        console.log('Object deleted successfully', data);
        res.status(200).send({
          message: 'Object deleted successfully',
          data: data,
        });
      }
    });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

app.get('/get-rides-by-filter', getRidesByFilters);

app.get('/onlineDrivers', onlineDrivers);

app.get('/allActiveDrivers', allActiveDrivers);

//pagination api for driver data
app.get('/paginatedDriverData', paginatedDriverData);

app.get('/search-drivers', searchDrivers);

app.get('/search-riders-by-name', searchRidersByName);

// driver crud
app.post('/create-driver', createDriver);

app.delete('/deleteRider/:uid', deleteRider);

app.get(`/getRiderById/:id`, getRiderById);

app.patch('/updateDriver/:uid', updateDriver);

app.patch('/update-driver-status/:uid', updateDriverStatus);

app.patch('/update-rider-status', updateRiderStatus);

app.get('/get-vehicle-data', getVehicleData);

// vehicleType

app.post('/create-vehicle-type', createVehicleType)

app.get('/get-vehicle-type', getVehicleType)

app.delete('/delete-vehicle-type/:id', deleteVehicleType)

app.get('/get-vehicle-type-id/:id', getVehicleOne)

app.patch('/updateVehicleType/:uid', updateVehicleType);

// fare

app.post('/add-fare', createFare)

app.get('/get-fare', getFareValue)

app.patch('/update-fare/:uid', upDateFareValue)

// spots crud
app.post("/create-spot", createSpot);

app.get("/get-spot-list", getSpotList);

app.delete("/delete-spot/:id", deleteSpot);

app.get('/get-active-spot', getActiveSpot);
app.get('/get-spot-list-vehicle', getSpotListVehicle)

// appName and Image

app.post('/create-app', createApp)

app.get('/get-app', getAppValue)

app.patch('/update-app/:uid', upDateAppValue)

// flows crud
app.post('/create-break-points', createBreakPoints);

app.get('/get-breaking-points', getBreakingPoints);

app.get('/get-breaking-points-mobile', getBreakingPointsMobile);

app.delete('/delete-breakingPoints/:id', deleteBreakingPoints);

app.patch('/update-break-points/:id', updateBreakPoints);

app.get('/get-break-point-id/:id', getBreakPointOne);

// driverAppFlow

app.post("/create-app-flow", createDriverAppFlow);

app.get("/get-app-flow", getAppFlow);

app.patch('/update-app-flow/:id', updateAppFlow)

// app.post('/login-time', loginTime);

// app.post('/logout-time', logoutTime)

// custom rides crud -----------------------------

app.post("/createRide", createCustomRides);

app.patch("/updateRide", updateRides);


// vehicle crud

app.post('/create-vehicle', createVehicleData);

app.post('/cancel-scheduled-ride', cancelScheduledRide);

app.patch('/updateVehicle/:uid', updateVehicle);

app.get('/paginatedVehicleData', paginatedVehicleData);

app.get('/search-ride', searchRide);

app.get('/search-vehicles', searchVehicles);

app.get('/getVehicleById/:id', getVehicleById);

app.post('/nearBydriver', nearBydriver);

app.post('/ride-assigned-by-admin', rideAssignedByAdmin);

app.get('/allAvailableVehicles', allAvailableVehicles);

app.get('/allAllVehicles', allAllVehicles);

app.post('/chat-gpt-api', chatGptApi);


// Country Code Crud

app.post("/create-country-code", createCountryCode);
app.get("/get-country-code", getCountryCodes);
// app.get("/get-country-code/:id", getCountryCodeOne);
app.delete("/delete-country-code/:id", deleteCountryCode);

// redis clients
// Redis pub/sub setup
export const pubClient = createClient({
  url:
    environmentVars.REDIS_URL ||
    'redis://default:Titandevil@12@redis-19288.c212.ap-south-1-1.ec2.cloud.redislabs.com:19288',
});
export const subClient = pubClient.duplicate();

// Log publisher and subscriber connection status
pubClient.on('ready', () => {
  console.log({
    message: 'Publisher connected to redis and ready to use',
  });
});
subClient.on('ready', () => {
  console.log({
    message: 'Subscriber connected to redis and ready to use',
  });
});

// Subscribe to specific channels for handling socket events
subClient.subscribe('join-availableDrivers-to-room', addDriversToRoom);
subClient.subscribe('join-rider-to-room', addRiderToRoom);
subClient.subscribe(
  'join-rider-to-room-for-scheduled-ride',
  addRiderToRoomForScheduled,
);
subClient.subscribe('cancel-scheduled-ride-cron', cancelScheduledRideCron);

//orders
subClient.subscribe('join-drivers-to-orders', sendOrderToDriverRoom);


// Log errors for publisher and subscriber clients
pubClient.on('error', () => console.log(`Publisher Client Error`));
subClient.on('error', () => console.log(`Subscriber Client Error`));

// Main server setup and initialization
(async () => {
  //wait for mongo to connect
  try {
    await mongoConnect();

    // Connect Redis publisher and subscriber clients
    await Promise.all([pubClient.connect(), subClient.connect()]);

    // Start the Express app server
    const server = app.listen(constants.PORT, () => {
      console.log('server listening on port ', constants.PORT);
    });

    //  ` setup
    io = new Server(server, {
      transports: ['websocket'],
      cors: {
        credentials: true,
        origin: '*',
      },
      // maxHttpBufferSize: 1e9,
    });

    io.adapter(createAdapter(pubClient, subClient));

    // Handle socket connections
    io.on('connection', async (socket: Socket) => {
      // const userId: string = String(socket.handshake.query['userId']);
      // const type: string = String(socket.handshake.query['type']);
      const Token: any = String(socket?.handshake.query?.['token']);
      // Validate user and type information from the socket handshake
      const data = decodeToken(Token);
      const userId = data.user._id;
      const type = data.type;
      if (!userId || !type) {
        socket.emit(
          'error',
          formatSocketResponse({ message: 'please attach userId and type' }),
        );
        socket.disconnect();
        console.log('Socket Disconnected ! userId or type not found');
        return;
      }
      try {
        if (type == 'driver') {
          await driverSocketConnected(socket, userId, io);
        } else if (type == 'rider') {
          await riderSocketConnected(socket, userId, io);
        }
      } catch (error: any) {
        socket.emit(
          'error',
          formatSocketResponse({
            message: error.message,
          }),
        );
        socket.disconnect();
      }
    });
    setUpCronJobs();
    // Enable Socket.IO admin panel for development
    instrument(io, {
      auth: false,
      mode: 'development',
    });
    //! app.listen should be here
  } catch (error) {
    console.error('Error is occured and the error is : ', error);
  }
})();

// cron.schedule('*/15 * * * *', function () {
//   FetchPayments();
// });

// cron.schedule('*/15 * * * *', function () {
//   console.log('running a task every 15 minutes');
//   FetchPayments();
// });
const getUtils = (): any => {
  return utilsData;
};

export { access_token, refreshToken };
export { getUtils };

