import { Driver, Rides, Admin } from '../models';
import { Request, Response } from 'express';
const jwt = require('jsonwebtoken');
const _ = require('lodash');
import environmentVars from '../constantsVars'

export async function adminLogin(req: Request, res: Response) {
  try {
    // console.log(`admin-login API >> body :>> `, req.body);
    const body = req.body;
    const { email, password } = body;
  
    

    if (!email || !password) {
      throw new Error(`Invalid email or password !`);
    }

    // Find the admin based on the provided credentials
    let adminDoc: any = await Admin.findOne({
      email,
      password,
    }).lean();
    // console.log(`admin-login >> adminDoc :>> `, adminDoc);

    // Check if the admin is registered
    if (!adminDoc) {
      throw new Error(`Invalid email or password !`);
    }

    // Generate a JWT token
    const token = jwt.sign({ email }, environmentVars.PUBLIC_KEY, {
      expiresIn: '7d',
    });
   

    return res.status(200).send({
      message: 'success',
      data: { token },
    });
  } catch (error: any) {
    console.log(`admin-login error :>> `, error);
    return res.status(401).send({ message: error.message });
  }
}

export async function adminRegister(req: Request, res: Response) {
  try {
    // console.log(`admin-login API >> body :>> `, req.body);
    const body = req.body;
    const { name, email,mobile_Number} = body;
    
    

    if (!name || !email || ! mobile_Number) {
      throw new Error(`Invalid data provided !`);
    }
    const password=(mobile_Number+"").slice(-4);

    // if (password !== confirmPassword) {
    //   throw new Error(`Passwords do not match !`);
    // }

     await Admin.create({
      name,
      email,
      mobile_Number,
      password,
      // confirmPassword,
    });
    

    // Generate a JWT token
    const token = jwt.sign({ email }, environmentVars.PUBLIC_KEY, {
      expiresIn: '7d',
    });

    return res.status(200).send({
      message: 'success',
      data: { token },
    });
  } catch (error: any) {
    console.log(`admin-register error :>> `, error);
    if (error.code === 11000) {
      return res.status(400).send({ message: 'Email already registered !' });
    }
    return res.status(400).send({ message: error.message });
  }
}

export async function changePassword(req: Request, res: Response) {
  try {
    // console.log(`admin change-password API >> body :>> `, req.body);
    const body = req.body;
    const { email, oldPassword, newPassword, confirmNewPassword } = body;

    if (!email || !oldPassword || !newPassword || !confirmNewPassword) {
      throw new Error(`Invalid data provided !`);
    }

    if (oldPassword === newPassword) {
      throw new Error(`Old & New Passwords must not match !`);
    }

    if (newPassword !== confirmNewPassword) {
      throw new Error(`New Passwords do not match !`);
    }

    let adminDoc: any = await Admin.findOneAndUpdate(
      { email, password: oldPassword },
      { password: newPassword },
      { new: true },
    );
    // console.log(`admin-register >> adminDoc :>> `, adminDoc);

    // Check if the admin is registered
    if (!adminDoc) {
      throw new Error(`Invalid email or password !`);
    }

    // Generate a JWT token
    const token = jwt.sign({ email }, environmentVars.PUBLIC_KEY, {
      expiresIn: '7d',
    });

    return res.status(200).send({
      message: 'success',
      data: { token },
    });
  } catch (error: any) {
    console.log(`admin change-password error :>> `, error);
    return res.status(401).send({ message: 'Invalid email or password !' });
  }
}

export async function dashboardData(req: Request, res: Response) {
  try {
    const resp = await Rides.aggregate([
      {
        $facet: {
          ongoing: [
            {
              $match: {
                status: {
                  $in: [
                    'pending-accept',
                    'pending-arrival',
                    'ride-started',
                    'pending-otp',
                    'pending-payment',
                  ],
                },
              },
            },
            { $count: 'Pending' },
          ],
          completed: [
            { $match: { status: { $in: ['completed'] } } },
            { $count: 'completed' },
          ],
        },
      },
    ]);
    const ongoingRidesCount = resp[0]['ongoing'][0]?resp[0]['ongoing'][0]['Pending']:0;
    const completedRidesCount = resp[0]['completed'][0]?resp[0]['completed'][0]['completed']:0;

    const response = await Driver.aggregate([
      {
        $facet: {
          onlineTotal: [
            { $match: { rideStatus: { $in: ['on-ride', 'online'] } } },
            { $count: 'online' },
          ],
          totalDrivers: [{ $count: 'total' }],
        },
      },
    ]);
    const onlineDriversCount = response[0]['onlineTotal'][0]?response[0]['onlineTotal'][0]['online']:0;
    const totalDriversCount = response[0]['totalDrivers'][0]?response[0]['totalDrivers'][0]['total']:0;

    const data = {
      ongoingRidesCount,
      completedRidesCount,
      onlineDriversCount,
      totalDriversCount,
    };

    res.status(200).send({
      message: 'Fetched dashboard data successfully',
      data: data,
    });
  } catch (error: any) {
    console.log(`dashboard-data error :>> `, error);
    res.status(400).send({ success: false, message: error.message });
  }
}

export async function rideAssignedByAdmin(req: Request, res: Response) {
  const body = req.body;
  const rideId = body.rideId;
  const driverId = body.driverId;
  let session;
  try {
    session = await Rides.startSession();
    session.startTransaction();
    if (!driverId && rideId) {
      throw new Error('Both driverId and rideId are required.');
    }
    const updatedRide = await Rides.findOneAndUpdate(
      { rideId },
      { status: 'pending-arrival', driverId: driverId },
      { session: session, new: true },
    );

    const updatedDriver = await Driver.findOneAndUpdate(
      { driverId },
      { rideStatus: 'on-ride' },
      { session: session, new: true },
    );
    await session.commitTransaction();
  } catch (err: any) {
    if (session) {
      await session.abortTransaction();
    }
    console.log('Fair error: ', err);
    res.status(400).send({ error: err.message });
  } finally {
    if (session) {
      await session.endSession();
    }
  }
}
