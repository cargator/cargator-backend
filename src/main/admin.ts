import { Driver } from '../models/driver.model';
import { Admin } from '../models/admin.model';
import { PlaceOrder } from '../models/placeOrder.model';
import { Request, Response } from 'express';
const jwt = require('jsonwebtoken');
const _ = require('lodash');
import environmentVars from '../constantsVars';
import { placeOrder } from './order';

export async function adminLogin(req: Request, res: Response) {
  try {
    // console.log(`admin-login API >> body :>> `, req.body);
    const body = req.body;
    const { mobile_Number, password } = body;

    if (!mobile_Number || !password) {
      throw new Error(`Invalid email or password !`);
    }

    // Find the admin based on the provided credentials
    let adminDoc: any = await Admin.findOne({
      mobile_Number,
      password,
    }).lean();
    // console.log(`admin-login >> adminDoc :>> `, adminDoc);

    // Check if the admin is registered
    if (!adminDoc) {
      throw new Error(`Invalid email or password !`);
    }

    const email = adminDoc.email;

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
    const { name, email, mobile_Number } = body;

    if (!name || !email || !mobile_Number) {
      throw new Error(`Invalid data provided !`);
    }
    const password = (mobile_Number + '').slice(-4);

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
    const token = jwt.sign(
      { email, mobile_Number },
      environmentVars.PUBLIC_KEY,
      {
        expiresIn: '7d',
      },
    );

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

//Admin created by another Admin or superAdmin
export async function createAdmin(req: Request, res: Response) {
  try {
    // console.log(`admin-login API >> body :>> `, req.body);
    const body = req.body;
    const { name, mobile_Number } = body;
    const email = body.email || '';

    if (!name || !mobile_Number) {
      throw new Error(`Invalid data provided !`);
    }
    const password = (mobile_Number + '').slice(-4);

    await Admin.create({
      name,
      email,
      mobile_Number,
      password,
    });

    return res.status(200).send({
      message: 'success',
    });
  } catch (error: any) {
    console.log(`admin-register error :>> `, error);
    if (error.code === 11000) {
      return res.status(400).send({ message: 'Email already registered !' });
    }
    return res.status(400).send({ message: error.message });
  }
}

export async function getAllAdmins(req: Request, res: Response) {
  try {
    // console.log(`admin-login API >> body :>> `, req.body);
    const page: number = parseInt(req.query.page as string, 10) || 1;
    const limit: number = parseInt(req.query.limit as string, 10) || 10;
    const skip = (page - 1) * limit;

    const adminResponse = await Admin.aggregate([
      {
        $facet: {
          admins: [
            {
              $sort: { updatedAt: -1 },
            },
            {
              $skip: skip,
            },
            {
              $limit: limit,
            },
          ],
          count: [
            {
              $count: 'totalCount',
            },
          ],
        },
      },
    ]);
    return res.status(200).send({
      message: 'success',
      data: adminResponse[0],
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
    const resp = await PlaceOrder.aggregate([
      {
        $facet: {
          ongoing: [
            {
              $match: {
                status: {
                  $in: [
                    'ALLOTTED',
                    'ARRIVED',
                    'DISPATCHED',
                    'ARRIVED_CUSTOMER_DOORSTEP',
                  ],
                },
              },
            },
            { $count: 'Pending' },
          ],
          completed: [
            { $match: { status: { $in: ['DELIVERED'] } } },
            { $count: 'completed' },
          ],
        },
      },
    ]);
    const ongoingOrderCount = resp[0]['ongoing'][0]
      ? resp[0]['ongoing'][0]['Pending']
      : 0;

    const completedRidesCount = resp[0]['completed'][0]
      ? resp[0]['completed'][0]['completed']
      : 0;

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
    const onlineDriversCount = response[0]['onlineTotal'][0]
      ? response[0]['onlineTotal'][0]['online']
      : 0;
    const totalDriversCount = response[0]['totalDrivers'][0]
      ? response[0]['totalDrivers'][0]['total']
      : 0;

    const data = {
      ongoingOrderCount,
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
