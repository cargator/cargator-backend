'use strict';

import express, { Request, Response, json } from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import environmentVars from './constantsVars';
import mongoConnect from './config/mongo';
import { setUpCronJobs } from './services/cronJobs';
import { getUtilsData } from './services/utilsService';
import * as adminHandlers from './main/admin';
import * as authHandlers from './main/auth';
import * as driverHandlers from './main/driver';
import * as mapHandlers from './main/map';
import * as paymentHandlers from './main/payment';
import * as vehicleHandlers from './main/vehiclesDetails';
import * as appHandlers from './main/app';
import * as countryCodeHandlers from './main/countrycode';
import * as orderHandlers from './main/order';
import { getSignedUrl, deleteObjectFromS3 } from './config/aws.config';
import { initializeSocketServer } from './config/socket';

const app = express();

app.use(cors());
app.use(json());

const authorize = async (req: any, res: Response, next: any) => {
  try {
    const token = req?.headers?.authorization?.split(' ')[1];
    if (token) {
      jwt.verify(token, environmentVars.PUBLIC_KEY, (err: any, decoded: any) => {
        if (err) {
          throw new Error('Invalid token');
        } else {
          req.decoded = decoded;
          next();
        }
      });
    } else {
      res.status(401).send({ success: false, message: 'No token provided' });
    }
  } catch (error: any) {
    res.status(403).send({ message: error.message });
  }
};

app.get('/', (req: Request, res: Response) => {
  res.send('success');
});

app.post('/login', authHandlers.handleLogin);
app.get('/getCountryCodeMobile', countryCodeHandlers.getCountryCodeMobiles);
app.post('/verifyOtp', authHandlers.verifyOtp);

app.get('/debounceTimeApi', async (req: Request, res: Response) => {
  try {
    const debounceTime = getUtilsData();
    res.send({ data: debounceTime });
  } catch (error: any) {
    console.error('Debounce Time error', error);
    res.status(400).send({ error: error.message });
  }
});

app.post('/razorPayCallback', (req, res) => {
  paymentHandlers.razorPayCallback(req, res);
});

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

    const url = await getSignedUrl(type, s3Params);

    if (!url) {
      throw new Error('URL not generated');
    }

    res.status(200).send({ message: 'URL received successfully', url });
  } catch (error: any) {
    console.error('Presigned URL error:', error);
    res.status(500).send({ error: error.message });
  }
});

app.post('/admin-login', adminHandlers.adminLogin);
app.get('/onlineDrivers', driverHandlers.onlineDrivers);
app.post('/admin-register', adminHandlers.adminRegister);
app.post("/place-order", orderHandlers.placeOrder);
app.put("/track-order-status", orderHandlers.trackOrderStatus);
app.put("/cancel-task", orderHandlers.cancelTask);
app.get("/getAppFlowMobile", appHandlers.getAppFlowMobile);
app.get("/get-order-history", orderHandlers.getOrderHistory);

app.use(authorize);

app.post("/get-history", orderHandlers.getHistory);
app.get("/progress", orderHandlers.getProgress);
app.post('/order-accept', orderHandlers.orderAccept);
app.post('/order-update', orderHandlers.orderUpdate);

if (environmentVars.MAP_MY_INDIA === 'false') {
  app.post('/get-address-from-autocomplete', mapHandlers.getAddressFromAutocomplete);
  app.post('/get-directions', mapHandlers.getDirection);
  app.post('/get-address-from-coordinates', mapHandlers.addressFromCoordinates);
  app.post('/get-coordinates-from-address', mapHandlers.coordinatesFromAddress);
} else {
  app.post('/get-address-from-autocomplete', mapHandlers.getAddressFromAutocompleteOlaMaps);
  app.post('/get-address-from-coordinates', mapHandlers.addressFromCoordinates);
  app.post('/get-directions', mapHandlers.getDirectionmapmyindia);
  app.post('/get-coordinates-from-address', mapHandlers.coordinatesFromAddress);
}

app.post('/get-fare', paymentHandlers.getFare);
app.post('/get-driver-location', driverHandlers.getDriverLocations);
app.delete('/deleteDriver/:uid', driverHandlers.deleteDriver);
app.get('/getDriverById/:id', driverHandlers.getDriverById);

app.delete('/deleteVehicle/:uid', vehicleHandlers.deleteVehicle);
app.post('/change-password', adminHandlers.changePassword);
app.get('/dashboard-data', adminHandlers.dashboardData);

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

const server = app.listen(environmentVars.PORT || 3000, () => {
  console.log('Server is running at ', environmentVars.PORT);
  mongoConnect();
  setUpCronJobs();

  initializeSocketServer(server);
  console.log("here ====> ");

});
