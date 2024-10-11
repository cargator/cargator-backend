import { Driver } from '../models/driver.model';
import { Admin } from '../models/admin.model';
import { PlaceOrder } from '../models/placeOrder.model';
import { Request, Response } from 'express';
const jwt = require('jsonwebtoken');
const _ = require('lodash');
import environmentVars from '../constantsVars';
import { placeOrder } from './order';
import mongoose from 'mongoose';
import { pushlogActivity } from '../helpers/common';
import { AdminAction } from '../shared/enums/status.enum';
import { Types } from 'mongoose';
import { Utils } from '../models';
import { error } from 'console';

export async function adminLogin(req: Request, res: Response) {
  try {
    // console.log(`admin-login API >> body :>> `, req.body);
    const body = req.body;
    const { mobile_Number, password } = body;

    if (!mobile_Number || !password) {
      throw new Error(`Invalid email or password !`);
    }

    // Find the admin based on the provided credentials
    // let adminDoc: any = await Admin.findOne({
    //   mobile_Number,
    //   password,
    // }).lean();

    let adminDoc = await Admin.findOne(
      {
        mobile_Number: mobile_Number.slice(-10),
        password,
        status: 'active',
      },
      { createdAt: 0, updatedAt: 0, password: 0 },
    ).lean();

    // console.log(`admin-login >> adminDoc :>> `, adminDoc);

    // Check if the admin is registered
    if (!adminDoc) {
      throw new Error(`Invalid mobile number or password !`);
    }

    // Generate a JWT token
    const token = jwt.sign({ ...adminDoc }, environmentVars.PUBLIC_KEY, {
      expiresIn: '7d',
    });

    console.log('admin loged in successfully', adminDoc);

    return res.status(200).send({
      message: 'success',
      data: { token, fullName: adminDoc.name },
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
export async function createAdmin(req: Request | any, res: Response) {
  try {
    
    const body = req.body;
    const { fullName, mobileNumber } = body;
    const email = body.email || `${fullName.split(' ')[0]}@gmail.com`;

    if (!fullName || !mobileNumber || fullName.trim()=='') {
      throw new Error(`Invalid data provided !`);
    }
    const password = (mobileNumber + '').slice(-4);

    let adminDoc = await Admin.create({
      name: fullName,
      email: email,
      mobile_Number: mobileNumber,
      password,
    });

    delete adminDoc.password;
    await pushlogActivity(
      req,
      AdminAction.CREATE,
      `Admin ${fullName}`,
      new Types.ObjectId(req.decoded._id),
      adminDoc,
    );

    return res.status(200).send({
      message: 'User Created successfully.',
    });
  } catch (error: any) {
    console.log(`admin-register error :>> `, error);
    if (error.code === 11000) {
      return res.status(400).send({ message: 'Number already registered !' });
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
    console.log(`get-all-admin error :>> `, error);
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

export async function deleteAdminUsers(req: Request | any, res: Response) {
  let session: any;
  try {
    session = await mongoose.startSession();
    session.startTransaction();

    const id = req.params.id;
    const adminDoc = await Admin.findOne({ _id: id }, { password: 0 }).lean();
    if (!adminDoc) {
      throw new Error('User not Found');
    }
    const deleteType = await Admin.deleteOne({ _id: id });

    if (!deleteType) {
      throw new Error('Error while deleting User');
    }

    await session.commitTransaction();
    await pushlogActivity(
      req,
      AdminAction.DELETE,
      `Admin ${adminDoc?.name}`,
      new Types.ObjectId(req.decoded._id),
      adminDoc,
    );
    res.status(200).send({
      message: ' User deleted Successfully.',
      data: deleteType,
    });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
    if (session) {
      await session.abortTransaction();
    }
    console.log('err :>> ', error);
  } finally {
    if (session) {
      await session.endSession();
    }
  }
}

export async function updateAdminUser(req: Request | any, res: Response) {
  let session: any;
  try {
    session = await mongoose.startSession();
    session.startTransaction();

    const id = req.params.id;
    let oldUser = await Admin.findById(id, { password: 0 }).lean();
    let user = await Admin.findOneAndUpdate(
      { _id: id },
      {
        name: req.body.fullName,
        mobile_Number: req.body.mobileNumber,
        password: req.body.mobileNumber.slice(-4),
      },
      { new: true },
    ).lean();

    delete user?.password;
    if (!user) {
      throw new Error('Error while getting user');
    }

    await session.commitTransaction();
    console.log('user:', user);

    await pushlogActivity(
      req,
      AdminAction.UPDATE,
      `Admin ${user?.name}`,
      new Types.ObjectId(req.decoded._id),
      { beforeUpdate: oldUser, afterUpdate: user },
    );

    res.status(200).send({
      message: ' user Updated Successfully.',
      data: user,
    });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
    if (session) {
      await session.abortTransaction();
    }
    console.log('err :>> ', error);
  } finally {
    if (session) {
      await session.endSession();
    }
  }
}

export async function updateAdminUserStatus(req: Request, res: Response) {
  let session: any;
  try {
    session = await mongoose.startSession();
    session.startTransaction();

    const id = req.params.id;

    const updateUserStatus = await Admin.findOneAndUpdate(
      {
        _id: id,
      },
      [
        {
          $set: {
            status: {
              $switch: {
                branches: [
                  { case: { $eq: ['$status', 'active'] }, then: 'inactive' },
                  { case: { $eq: ['$status', 'inactive'] }, then: 'active' },
                ],
                default: 'active',
              },
            },
          },
        },
      ],
      { new: true }, // Return the updated document
    ).lean();

    await session.commitTransaction();
    res.status(200).send({
      message: ' user status updated Successfully.',
      data: updateUserStatus,
    });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
    if (session) {
      await session.abortTransaction();
    }
    console.log('err :>> ', error);
  } finally {
    if (session) {
      await session.endSession();
    }
  }
}

export async function getAdminUserOne(req: Request, res: Response) {
  let session: any;
  try {
    session = await mongoose.startSession();
    session.startTransaction();

    const id = req.params.id;

    const user = await Admin.findById({ _id: id });

    if (!user) {
      throw new Error('Error while getting users');
    }

    await session.commitTransaction();
    res.status(200).send({
      message: ' user got Successfully.',
      data: user,
    });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
    if (session) {
      await session.abortTransaction();
    }
    console.log('err :>> ', error);
  } finally {
    if (session) {
      await session.endSession();
    }
  }
}

// ----------- Map Functions for create, get, update ------------

// export async function createNewMapFlow(req: Request, res: Response) {
//   let session: any;
//   try {
//     session = await mongoose.startSession();
//     session.startTransaction();

//     const { selectedMapOption } = req.body;
//     console.log('object', selectedMapOption);

//     const res = await Utils.create(
//       [
//         {
//           currentMap: selectedMapOption,
//         },
//       ],
//       { session: session },
//     );

//     if (!flowres) {
//       throw new Error('Error while creating application flow');
//     }

//     await session.commitTransaction();
//     res.status(200).send({
//       message: ' App Flow craeted successfully.',
//       data: flowres,
//     });
//   } catch (error: any) {
//     res.status(400).json({ success: false, message: error.message });
//     if (session) {
//       await session.abortTransaction();
//     }
//     console.log('err :>> ', error);
//   } finally {
//     if (session) {
//       await session.endSession();
//     }
//   }
// }
