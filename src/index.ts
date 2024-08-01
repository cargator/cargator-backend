'use strict';

// Library Imports
import { createAdapter } from '@socket.io/redis-adapter';
import cors from 'cors';
import express, { Request, Response, json } from 'express';
import { createClient } from 'redis';
import { Server, Socket } from 'socket.io';
import environmentVars from './constantsVars';
// Files Imports
import axios from 'axios';
import mongoConnect from './config/mongo';
import constants from './constantsVars';
import { formatSocketResponse } from './helpers/common';
import driverSocketConnected, { getAllSocket } from './helpers/driverEvents';
import {
  adminLogin,
  adminRegister,
  changePassword,
  dashboardData,
} from './main/admin';
import {
  createApp,
  createDriverAppFlow,
  getAppFlowMobile,
  getAppValue,
  getCurrentFlow,
  upDateAppValue,
  updateAppFlow,
} from './main/app';
import { handleLogin, verifyOtp } from './main/auth';
import { chatGptApi } from './main/chatGpt';
import {
  createCountryCode,
  deleteCountryCode,
  getCountryCodeMobiles,
  getCountryCodes,
} from './main/countrycode';
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
  updateFcmToken,
  updateLiveLocation,
} from './main/driver';
import { createFare, getFareValue, upDateFareValue } from './main/fare';
import {
  createBreakPoints,
  deleteBreakingPoints,
  getBreakPointOne,
  getBreakingPoints,
  getBreakingPointsMobile,
  updateBreakPoints,
} from './main/flows';
import {
  cancelTask,
  getDriversPendingOrders,
  getHistory,
  getOrderById,
  getOrderHistory,
  getProgress,
  getpendingOrders,
  orderUpdateStatus,
  placeOrder,
  testOrder,
  trackOrderStatus,
  updatePaymentStatusOfOrder,
} from './main/order';
import {
  createSpot,
  deleteSpot,
  getActiveSpot,
  getSpotList,
  getSpotListVehicle,
} from './main/spots';
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
import {
  createVehicleType,
  deleteVehicleType,
  getVehicleOne,
  getVehicleType,
  updateVehicleType,
} from './main/vehicleType';
import { Utils } from './models';
import { CronExpressions } from './shared/enums/CronExpressions';
import { Driver } from './models/driver.model';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { deleteObjectFromS3, getSignedUrlForS3 } from './config/aws.config';

let utilsData: any;

const _ = require('lodash');
const jwt = require('jsonwebtoken');
const app = express();
const cron = require('node-cron');
const CronJob = require('cron').CronJob;


const sendToAllRiders: any = (data: any) => {
  try {
    const dataNew = JSON.parse(data);
    const driverSocket = getAllSocket();
    for (let index = 0; index < Object.values(driverSocket).length; index++) {
      const element: any = Object.values(driverSocket)[index];
      element.emit(dataNew.type, formatSocketResponse(dataNew.message));
    }
  } catch (error: any) {
    console.log('error :', error);
  }
};

const sendNewOrderToAllRiders: any = (data: any) => {
  try {
    const driverSocket = getAllSocket();
    for (let index = 0; index < Object.values(driverSocket).length; index++) {
      const element: any = Object.values(driverSocket)[index];
      element.emit('new-order', data);
    }
  } catch (error) {
    console.log('error', error);
  }
};

let io: Server;

// Configure Express app with necessary middleware
app.use(cors());
app.use(json());


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
    utilsData = await Utils.findOne();

    await refreshToken();

    // Create a new cron job
    const job = new CronJob(CronExpressions.EVERY_4_HOURS, async () => {
      // This function will be executed when the cron job runs every 15 minutes
      try {
        utilsData = await Utils.findOne();
      } catch (error) {
        console.log('update utils error', error);
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

    // New cron job to set driver status to offline at 2 AM every day
    cron.schedule(CronExpressions.EVERY_DAY_2_AM, async () => {
      try {
        await Driver.updateMany(
          { rideStatus: 'online' },
          { $set: { rideStatus: 'offline' } },
        );
      } catch (err) {
        console.error('Error updating driver status:', err);
      }
    });
  } catch (err) {
    console.log('err', err);
  }
}

export async function getDriverStatus(req: any, res: Response) {
  const driverId = req.decoded.user._id;
  try {
    const getStatus = await Driver.findOne({
      _id: driverId,
    }).lean();

    res.status(200).send({
      status: true,
      message: 'Status get succcessfully.',
      data: getStatus,
    });
  } catch (err: any) {
    res.status(200).send({
      status: true,
      message: err.message,
    });
  }
}

export async function toggleDriverStatus(req: any, res: Response) {
  console.log('i am here');

  const driverId = req.decoded.user._id;
  try {
    await Driver.updateOne(
      {
        _id: driverId,
        rideStatus: { $ne: 'on-ride' },
      },
      [
        {
          $set: {
            rideStatus: {
              $switch: {
                branches: [
                  { case: { $eq: ['$rideStatus', 'online'] }, then: 'offline' },
                  { case: { $eq: ['$rideStatus', 'offline'] }, then: 'online' },
                ],
                default: '',
              },
            },
          },
        },
      ],
    );
    res.status(200).send({
      status: true,
      // vendor_order_id: order_details.vendor_order_id,
      message: 'Order created succcessfully.',
    });
  } catch (err: any) {
    res.status(200).send({
      status: true,
      // vendor_order_id: order_details.vendor_order_id,
      message: err.message,
    });
  }
}

// container health check endpoint
app.get('/', (req: Request, res: Response) => {
  res.send('success');
});

// Middleware function to authorize requests with a JWT token
const authorize = async (req: any, res: Response, next: any) => {
  try {
    const token = req?.headers?.authorization?.split(' ')[1];
    if (token) {
      // Verify the JWT token
      jwt.verify(
        token,
        environmentVars.PUBLIC_KEY,
        (err: any, decoded: any) => {
          if (err) {
            throw new Error('Invalid token');
            // res.status(401).send({ message: 'Token invalid' });
            // res.json({ success: false, message: "Token invalid" }); // Token has expired or is invalid
          } else {
            req.decoded = decoded; // Assign to req. variable to be able to use it in next() route ('/me' route)
            next(); // Required to leave middleware
          }
        },
      );
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
    return data;
  } catch (error) {
    return false;
  }
};

// Route for user login with OTP generation
app.post('/login', handleLogin);
app.get('/getCountryCodeMobile', getCountryCodeMobiles);
// Route for verifying OTP and generating authentication token
app.post('/verifyOtp', verifyOtp);

app.post('/presignedurl', async (req, res) => {
  try {
    const { key, contentType, type } = req.body;
    if (!key || !type) {
      return res.status(400).send({ error: 'Key and type are required' });
    }

    const s3Params: any = {
      Bucket: 'cargator',
      Key: key,
      Expires: 60 * 60,
    };

    if (type === 'put') {
      s3Params.ContentType = contentType;
    }

    const url = await getSignedUrlForS3(type, s3Params);

    if (!url) {
      throw new Error('URL not generated');
    }

    res.status(200).send({ message: 'URL received successfully', url: url });
  } catch (error: any) {
    console.error('Presigned URL error:', error);
    res.status(500).send({ error: error.message });
  }
});

app.get('/test-order', testOrder);
// Route for admin login
app.post('/admin-login', adminLogin);

// Route for admin register
app.post('/admin-register', adminRegister);

// PetPooja API's--------------------

app.post('/place-order', placeOrder);

app.put('/track-order-status', trackOrderStatus);

app.put('/cancel-task', cancelTask);

app.get('/getAppFlowMobile', getAppFlowMobile);

app.get('/get-order-history', getOrderHistory);

app.get('/get-order/:id', getOrderById);

app.use(authorize);

app.post('/toggle-driver-status', toggleDriverStatus);

app.get('/get-driver-status', getDriverStatus);

app.post('/get-history', getHistory);
app.get('/progress', getProgress);
app.post(`/update-live-location`, updateLiveLocation);
app.post('/update-FCM-token', updateFcmToken);
app.post('/update-order-status', orderUpdateStatus);

app.get('/get-pending-orders', getpendingOrders);
app.get('/get-my-pending-order', getDriversPendingOrders);
app.post('/update-payment-status-of-order', updatePaymentStatusOfOrder);

// app.get('/fetchPendingPayments', async (req: Request, res: Response) => {
//   FetchPayments();
// res.sendStatus(200);
// });

app.post('/get-driver-location', getDriverLocations);

//pagination api for driver data

// driver crud

app.delete('/deleteDriver/:uid', deleteDriver);

app.get('/getDriverById/:id', getDriverById);

// vehicle crud

app.delete('/deleteVehicle/:uid', deleteVehicle);

// Route for admin change password
app.post('/change-password', changePassword);

app.get('/dashboard-data', dashboardData);

//pagination api for driver data

app.post('/delete-object-from-s3', async (req, res) => {
  try {
    const { key } = req.body;
    if (!key) {
      return res.status(400).json({ success: false, message: 'Key is required' });
    }
    const data = await deleteObjectFromS3('cargator', key);
    console.log('Object deleted successfully', data);

    res.status(200).send({ message: 'Object deleted successfully', data });
  } catch (error: any) {
    console.error('Error deleting object:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});


app.get('/onlineDrivers', onlineDrivers);

app.get('/allActiveDrivers', allActiveDrivers);

//pagination api for driver data
app.get('/paginatedDriverData', paginatedDriverData);

app.get('/search-drivers', searchDrivers);

// driver crud
app.post('/create-driver', createDriver);

app.patch('/updateDriver/:uid', updateDriver);

app.patch('/update-driver-status/:uid', updateDriverStatus);

app.get('/get-vehicle-data', getVehicleData);

// vehicleType

app.post('/create-vehicle-type', createVehicleType);

app.get('/get-vehicle-type', getVehicleType);

app.delete('/delete-vehicle-type/:id', deleteVehicleType);

app.get('/get-vehicle-type-id/:id', getVehicleOne);

app.patch('/updateVehicleType/:uid', updateVehicleType);

// fare

app.post('/add-fare', createFare);

app.get('/get-fare', getFareValue);

app.patch('/update-fare/:uid', upDateFareValue);

// spots crud
app.post('/create-spot', createSpot);

app.get('/get-spot-list', getSpotList);

app.delete('/delete-spot/:id', deleteSpot);

app.get('/get-active-spot', getActiveSpot);
app.get('/get-spot-list-vehicle', getSpotListVehicle);

// appName and Image

app.post('/create-app', createApp);

app.get('/get-app', getAppValue);

app.patch('/update-app/:uid', upDateAppValue);

// flows crud
app.post('/create-break-points', createBreakPoints);

app.get('/get-breaking-points', getBreakingPoints);

app.get('/get-breaking-points-mobile', getBreakingPointsMobile);

app.delete('/delete-breakingPoints/:id', deleteBreakingPoints);

app.patch('/update-break-points/:id', updateBreakPoints);

app.get('/get-break-point-id/:id', getBreakPointOne);

// driverAppFlow

app.post('/create-app-flow', createDriverAppFlow);

app.get('/get-app-flow', getCurrentFlow);

app.patch('/update-app-flow/:id', updateAppFlow);

// app.post('/login-time', loginTime);

// app.post('/logout-time', logoutTime)

// vehicle crud

app.post('/create-vehicle', createVehicleData);

app.patch('/updateVehicle/:uid', updateVehicle);

app.get('/paginatedVehicleData', paginatedVehicleData);

app.get('/search-vehicles', searchVehicles);

app.get('/getVehicleById/:id', getVehicleById);

app.post('/nearBydriver', nearBydriver);

app.get('/allAvailableVehicles', allAvailableVehicles);

app.get('/allAllVehicles', allAllVehicles);

app.post('/chat-gpt-api', chatGptApi);

// Country Code Crud

app.post('/create-country-code', createCountryCode);
app.get('/get-country-code', getCountryCodes);
// app.get("/get-country-code/:id", getCountryCodeOne);
app.delete('/delete-country-code/:id', deleteCountryCode);

// redis clients
// Redis pub/sub setup

export const pubClient = createClient({
  password: environmentVars.REDIS_PASSWORD,
  socket: {
    host: environmentVars.REDIS_URL,
    port: 10131,
  },
});

// export const pubClient = createClient({
//   url:
//     environmentVars.REDIS_URL ||
//     'redis://default:Titandevil@12@redis-19288.c212.ap-south-1-1.ec2.cloud.redislabs.com:19288',
// });
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

//orders
subClient.subscribe('order-update-response', sendToAllRiders);
subClient.subscribe('new-order', sendNewOrderToAllRiders);

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
      pingInterval: 10000,
      pingTimeout: 10000,
      cors: {
        credentials: true,
        origin: '*',
      },
      transports: ['websocket', 'polling'],
      // maxHttpBufferSize: 1e9,
    });

    io.adapter(createAdapter(pubClient, subClient));

    // Handle socket connections
    io.on('connection', async (socket: Socket) => {
      // console.log('socket.conn.transport ==> ',socket.conn.transport);
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

export { access_token, getUtils, refreshToken };
