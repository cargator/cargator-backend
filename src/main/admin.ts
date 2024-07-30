import { PipelineStage } from 'mongoose';
import { Driver, Rides, Admin, PlaceOrder } from '../models';
import { Request, Response } from 'express';
const jwt = require('jsonwebtoken');
const _ = require('lodash');
import environmentVars from '../constantsVars'
import { placeOrder } from './order';

export async function adminLogin(req: Request, res: Response) {
  try {
    // console.log(`admin-login API >> body :>> `, req.body);
    const body = req.body;
    const { email, password } = body;
  
    

    if (!email || !password) {
      throw new Error(`Invalid email or password !`);
    }

    let adminDoc: any = await Admin.findOne({
      email,
      password,
    }).lean();
    
    // let adminDoc: any = await Admin.findOneAndUpdate(
    //   { email, password }, 
    //   { status: 'online' }, 
    //   { new: true, lean: true }
    // ).lean();
 
    if (!adminDoc) {
      throw new Error(`Invalid email or password !`);
    }

    // Generate a JWT token
    const token = jwt.sign({ email }, environmentVars.PUBLIC_KEY, {
      expiresIn: '7d',
    });
    console.log(adminDoc);
    const super_Admin=adminDoc.super_Admin;
    

    return res.status(200).send({
      message: 'success',
      data: { token ,super_Admin},
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
    const super_Admin=false;
    const status="active";
    
    

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
      // status,
      super_Admin,
      password,
      // confirmPassword,
    });
    

    // Generate a JWT token
    const token = jwt.sign({ email }, environmentVars.PUBLIC_KEY, {
      expiresIn: '7d',
    });
    console.log(token);
    
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
    const ongoingOrderCount = resp[0]['ongoing'][0]?resp[0]['ongoing'][0]['Pending']:0;
    
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




export async function getAllAdmins(req: Request, res: Response) {
  try {
    // Extract and validate query parameters
    const page: number = parseInt(req.query.page as string) || 1;
    const limit: number = parseInt(req.query.limit as string) || 10;
    const dataLimit = limit;
    const skip = (page - 1) * dataLimit;    const email = req.headers['email'] as string;

    const user = await Admin.findOne({ email }).exec();
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const isSuperAdmin = user.super_Admin;

    const pipeline: any[] = [
      {
        $facet: {
          Admin: [
            // Include or exclude super admins based on user's role
            ...(isSuperAdmin ? [] : [{ $match: { super_Admin: false } }]),
            { $sort: { updatedAt: -1 } },
            { $skip: skip },
            { $limit: dataLimit },
          ],
          totalAdmin: [{ $count: 'count' }],
        },
      },
    ];
   
    const allAdmin = await Admin.aggregate(pipeline).exec();
    
    if (!allAdmin || allAdmin.length === 0) {
      return res.status(404).json({ success: false, message: 'No admins found' });
    }

    const totalAdmin = allAdmin[0].totalAdmin[0]?.count || 0;

    return res.status(200).json({
      message: 'Admins fetched successfully',
      data: allAdmin[0].Admin,
      totalAdmin,
    });
  } catch (error: any) {
    console.error(error); // Log error for debugging
    res.status(500).json({ success: false, message: 'An error occurred while fetching admins' });
  }
}

export async function deleteAdmin(req: Request, res: Response)
{
  try {
    const _id = req.params.id;
    const x=await Admin.findByIdAndDelete(_id);
    if(x){
      return res.status(200).json({
        message: 'Admins deletetd successfully',
      });
    }
  } catch (error) {
    console.error(error); // Log error for debugging
    res.status(500).json({ success: false, message: 'An error occurred while fetching admins' });
  }
}


export async function makeSuperAdmin(req: Request, res: Response) {
  try {
    const _id = req.params.id;
    const admin = await Admin.findByIdAndUpdate(_id, { super_Admin: true }, { new: true });

    if (admin) {
      return res.status(200).json({
        message: 'Admin updated to Super Admin successfully',
        admin: admin  // Optionally return the updated admin object
      });
    } else {
      return res.status(404).json({
        success: false,
        message: 'Admin not found'
      });
    }
  } catch (error) {
    console.error(error); // Log error for debugging
    res.status(500).json({
      success: false,
      message: 'An error occurred while updating super admin'
    });
  }
}

export async function updateAdmin(req: Request, res: Response) {
  try {
    const _id = req.params.id;
    const body = req.body;

    const admin = await Admin.findByIdAndUpdate(_id,body,{ new: true });

    if (admin) {
      return res.status(200).json({
        message: 'Admin updated successfully',
        admin: admin  
      });
    } else {
      return res.status(404).json({
        success: false,
        message: 'Admin not found'
      });
    }
  } catch (error) {
    console.error('Error updating admin:', error); 
    res.status(500).json({
      success: false,
      message: 'An error occurred while updating admin'
    });
  }
}