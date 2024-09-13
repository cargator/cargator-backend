import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { getUtils } from '..';
import environmentVars from '../constantsVars';
import { Driver } from '../models/driver.model';
import { Vehicles } from '../models';
import { pathCoords, Timeline } from '../models/timeline.model';
import { Types } from 'mongoose';
import { PlaceOrder } from '../models/placeOrder.model';
const AWS = require('aws-sdk');
AWS.config.update({
  region: environmentVars.AWS_REGION,
  accessKeyId: environmentVars.AWS_ACCESS_KEY_ID,
  secretAccessKey: environmentVars.AWS_SECRET_ACCESS_KEY,
});

const getSearchDriver = async (req: Request) => {
  try {
    const page = parseInt(String(req?.query?.page));
    const dataLimit = parseInt(String(req?.query?.limit));
    const query = req.query.query;
    const skip = (page - 1) * dataLimit;
    const currentRides = await Driver.aggregate([
      {
        $facet: {
          data: [
            {
              $match: {
                $or: [
                  {
                    firstName: {
                      $regex: new RegExp(`^${query}`, 'i'),
                    },
                  },
                  {
                    lastName: {
                      $regex: new RegExp(`^${query}`, 'i'),
                    },
                  },
                  {
                    mobileNumber: {
                      $regex: new RegExp(`^${query}`, 'i'),
                    },
                  },
                  {
                    vehicleNumber: {
                      $regex: new RegExp(`^${query}`, 'i'),
                    },
                  },
                  {
                    vehicleType: {
                      $regex: new RegExp(`${query}`, 'i'),
                    },
                  },
                  {
                    rideStatus: {
                      $regex: new RegExp(`^${query}`, 'i'),
                    },
                  },
                ],
              },
            },
            {
              $project: {
                _id: 1, // Include the _id field
                firstName: 1, // Include the title field from the Post collection
                lastName: 1,
                mobileNumber: 1,
                vehicleNumber: 1,
                vehicleType: 1,
                rideStatus: 1,
              },
            },
            {
              $sort: { createdAt: -1 },
            },
            {
              $skip: skip,
            },
            {
              $limit: dataLimit,
            },
          ],
          count: [
            {
              $match: {
                $or: [
                  {
                    firstName: {
                      $regex: new RegExp(`^${query}`, 'i'),
                    },
                  },
                  {
                    lastName: {
                      $regex: new RegExp(`^${query}`, 'i'),
                    },
                  },
                  {
                    mobileNumber: {
                      $regex: new RegExp(`^${query}`, 'i'),
                    },
                  },
                  {
                    vehicleNumber: {
                      $regex: new RegExp(`^${query}`, 'i'),
                    },
                  },
                  {
                    vehicleType: {
                      $regex: new RegExp(`${query}`, 'i'),
                    },
                  },
                  {
                    rideStatus: {
                      $regex: new RegExp(`^${query}`, 'i'),
                    },
                  },
                ],
              },
            },
            { $count: 'totalcount' },
          ],
        },
      },
    ]);
    return currentRides;
  } catch (error) {
    console.log('getSearchRides error:', error);
  }
};

export async function searchDrivers(req: Request, res: Response) {
  try {
    const response = await getSearchDriver(req);
    res.status(200).json({
      message: 'fetched Driver data successfully',
      data: response,
    });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
}

export async function createDriver(req: Request, res: Response) {
  let session: any;
  try {
    session = await mongoose.startSession();
    session.startTransaction();
    const {
      firstName,
      lastName,
      vehicleNumber,
      vehicleType,
      vehicleName,
      mobileNumber,
      profileImageKey,
      documentsKey,
    } = req.body;

    // Check if the vehicle is available
    if (vehicleNumber !== 'none') {
      const vehicle = await Vehicles.findOne(
        {
          vehicleNumber: vehicleNumber.toUpperCase(),
          vehicleStatus: 'unavailable',
        },
        null,
        { session },
      );
      if (vehicle) {
        throw new Error('Vehicle is already assigned to someone.');
      }
    }

    // Check if the mobile number already exists
    const existingDriver = await Driver.findOne(
      { mobileNumber: `91${mobileNumber}` },
      null,
      { session },
    );
    if (existingDriver) {
      throw new Error('A Rider with this mobile number already exists.');
    }
    const driverId = Math.floor(Math.random() * 9000 + 1000);

    const driverData = {
      driverId,
      firstName,
      lastName,
      vehicleNumber:
        vehicleNumber === 'none' ? '' : vehicleNumber.toUpperCase(),
      vehicleType: vehicleNumber === 'none' ? '' : vehicleType,
      vehicleName: vehicleNumber === 'none' ? '' : vehicleName,
      mobileNumber: `91${mobileNumber}`,
      profileImageKey,
      documentsKey,
    };

    const driver = await Driver.create([driverData], { session });
    if (driver.length === 0) {
      throw new Error('Error while creating driver');
    }

    // Update vehicle status if a vehicle is assigned
    if (vehicleNumber !== 'none') {
      const vehicle = await Vehicles.findOneAndUpdate(
        {
          vehicleNumber: vehicleNumber.toUpperCase(),
          vehicleStatus: 'available',
        },
        { vehicleStatus: 'unavailable', vehicleAssignedToId: driver[0]._id },
        { session, new: true },
      );
      if (!vehicle) {
        throw new Error('Error while updating vehicle');
      }
    }

    await session.commitTransaction();
    res.status(200).send({ message: 'Driver data saved.' });
  } catch (error: any) {
    if (session) {
      await session.abortTransaction();
    }
    console.error('Error:', error.message);
    res.status(400).json({ success: false, message: error.message });
  } finally {
    if (session) {
      await session.endSession();
    }
  }
}

export async function deleteDriver(req: Request, res: Response) {
  let session: any;

  try {
    console.log('---------------------');
    const s3 = new AWS.S3();
    session = await mongoose.startSession();
    // const id = req.params.uid;
    const body = {
      uid: req.params.uid,
      profileImageKey: req.headers['x-profile-image-key'],
      documentsKey: req.headers['x-documents-key']
        ? req.headers['x-documents-key'][0]
        : undefined,
    };
    session.startTransaction();
    const vehicle = await Vehicles.findOneAndUpdate(
      { vehicleAssignedToId: body.uid },
      { vehicleStatus: 'available', vehicleAssignedToId: '' },
      { session: session, new: true },
    );

    // console.log(' vehicle :>> ', vehicle);
    const findDriver = await Driver.findOne({
      _id: body.uid,
      status: 'active',
    });
    if (!findDriver) {
      throw new Error('Driver not found');
    }
    const deleteDriver = await Driver.findOneAndUpdate(
      { _id: body.uid },
      { status: 'inactive' },
      { session: session },
    );

    // if (body?.profileImageKey !== undefined) {
    //   const params = {
    //     Bucket: 'cargator',
    //     Key: body?.profileImageKey, // Replace with the key of the object you want to delete
    //   };

    //   s3.deleteObject(params, (err: any, data: any) => {
    //     if (err) {
    //       console.error('Error deleting object:', err);
    //     } else {
    //       console.log('Object deleted successfully', data);
    //     }
    //   });
    // }

    // if (Array.isArray(body?.documentsKey) && body?.documentsKey.length > 0) {
    //   console.log('object docs:>> ');
    //   body.documentsKey.forEach((element: string) => {
    //     const params = {
    //       Bucket: 'cargator',
    //       Key: element, // Replace with the key of the object you want to delete
    //     };

    //     s3.deleteObject(params, (err: any, data: any) => {
    //       if (err) {
    //         console.error('Error deleting object:', err);
    //       } else {
    //         console.log('Object deleted successfully', data);
    //       }
    //     });
    //   });
    // }

    await session.commitTransaction();
    res.status(200).send({
      message: ' Driver data deleted.',
    });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
    if (session) {
      await session.abortTransaction();
    }
    // console.log('err while vehicle update:>> ', err);
  } finally {
    await session.endSession();
  }
}

export async function getDriverById(req: Request, res: Response) {
  try {
    const driverId = req.params.id;
    const driverData = await Driver.findById(driverId);
    if (!driverData) {
      throw new Error('Error while fetching data, invalid id');
    }
    res.status(200).json({
      message: 'fetched driver data successfully',
      data: driverData,
    });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
}

export async function updateDriver(req: Request, res: Response) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const {
      firstName,
      lastName,
      vehicleNumber,
      vehicleType,
      vehicleName,
      mobileNumber,
      profileImageKey,
      documentsKey,
    } = req.body;
    const id = req.params.uid;

    let driver = await Driver.findOne({
      _id: id,
      status: 'active',
      rideStatus: { $ne: 'on-ride' },
    }).session(session);

    if (!driver) {
      throw new Error(
        'Driver not found, status is inactive or driver is on-ride',
      );
    }

    if (vehicleNumber !== 'none') {
      const vehicle = await Vehicles.findOneAndUpdate(
        { vehicleNumber: vehicleNumber.toUpperCase() },
        { vehicleStatus: 'unavailable', vehicleAssignedToId: id },
        { session },
      );

      if (!vehicle) {
        throw new Error('Vehicle not found');
      }

      if (
        driver.vehicleNumber &&
        driver.vehicleNumber !== vehicleNumber.toUpperCase()
      ) {
        await Vehicles.findOneAndUpdate(
          { vehicleNumber: driver.vehicleNumber, vehicleStatus: 'unavailable' },
          { vehicleStatus: 'available', vehicleAssignedToId: '' },
          { session },
        );
      }

      driver.vehicleType = vehicleType;
      driver.vehicleNumber = vehicleNumber.toUpperCase();
      driver.vehicleName = vehicleName;
    } else {
      if (driver.vehicleNumber) {
        await Vehicles.findOneAndUpdate(
          { vehicleNumber: driver.vehicleNumber, vehicleStatus: 'unavailable' },
          { vehicleStatus: 'available', vehicleAssignedToId: '' },
          { session },
        );
      }

      driver.vehicleType = '';
      driver.vehicleNumber = '';
      driver.vehicleName = '';
    }

    driver.firstName = firstName;
    driver.lastName = lastName;
    driver.mobileNumber = `91${mobileNumber}`;
    driver.profileImageKey = profileImageKey;
    driver.documentsKey = documentsKey;

    await driver.save({ session });

    await session.commitTransaction();
    res.status(200).send({ message: 'Updated driver data successfully' });
  } catch (error: any) {
    await session.abortTransaction();

    if (error.code === 11000) {
      // Handle duplicate key error
      res.status(400).json({
        success: false,
        message: 'Mobile number already exists.',
      });
    } else {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  } finally {
    session.endSession();
  }
}

export async function updateDriverStatus(req: Request, res: Response) {
  let session: any;
  try {
    session = await mongoose.startSession();
    const id = req.params.uid;
    session.startTransaction();
    const result = await Driver.findOneAndUpdate(
      {
        _id: id,
        status: 'active',
      },
      {
        status: 'inactive',
        vehicleName: null,
        vehicleNumber: null,
        vehicleType: null,
      },
      { session: session },
    );

    // console.log('result :>> ', result);

    if (result) {
      await Vehicles.findOneAndUpdate(
        { vehicleNumber: result?.vehicleNumber },
        { vehicleStatus: 'available' },
        { session: session },
      );
    }

    if (!result) {
      const resultTwo = await Driver.findOneAndUpdate(
        {
          _id: id,
          status: 'inactive',
        },
        {
          status: 'active',
        },
        { session: session },
      );

      if (!resultTwo) {
        throw new Error('Could not find the driver, invalid id');
      }
    }
    await session.commitTransaction();
    res.status(200).send({
      message: 'Driver status updated successfully',
    });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
    if (session) {
      await session.abortTransaction();
    }
  } finally {
    if (session) {
      await session.endSession();
    }
  }
}

export async function paginatedDriverData(req: Request, res: Response) {
  try {
    const page: any = req?.query?.page;
    const limit: any = req.query.limit;
    let status = ['online', 'offline'];
    if (req.query?.status === 'online' || req.query?.status === 'offline') {
      status = [req.query?.status];
    }
    const dataLimit = parseInt(limit);
    const skip = (parseInt(page) - 1) * dataLimit;
    const allDrivers = await Driver.aggregate([
      {
        $facet: {
          drivers: [
            {
              $match: {
                rideStatus: { $in: status },
              },
            },
            { $sort: { updatedAt: -1 } },
            { $skip: skip },
            { $limit: dataLimit },
          ],
          totalDrivers: [
            {
              $match: {
                rideStatus: { $in: status },
              },
            },
            { $count: 'count' },
          ],
        },
      },
    ]);
    const totalDrivers = allDrivers[0]['totalDrivers']?.[0]?.['count'] || 0;
    if (!allDrivers || allDrivers.length === 0) {
      throw new Error('Drivers not found');
    }

    return res.status(200).json({
      message: 'This vehicle is already assigned to you',
      data: allDrivers[0]['drivers'],
      totalDrivers,
    });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
}

export async function onlineDrivers(req: Request, res: Response) {
  try {
    const allDrivers = await Driver.find({
      rideStatus: ['online', 'on-ride'],
      status: 'active',
    });
    // console.log('all online drivers--->', allDrivers);
    return res.send(allDrivers);
  } catch (error) {
    console.log('onlineDrivers API', error);
  }
}

export async function allActiveDrivers(req: Request, res: Response) {
  try {
    const allDrivers = await Driver.find({
      status: 'active',
    });
    console.log('all online drivers--->', allDrivers);
    return res.send(allDrivers);
  } catch (error) {
    console.log('onlineDrivers API', error);
  }
}

export async function getDriverLocations(req: Request, res: Response) {
  try {
    const driverId = req.body.driverId;
    // console.log(`get-driver-location body :>> `, body);
    const response = await Driver.findById(driverId).lean();
    const driverLocation = {
      latitude: response?.liveLocation[1],
      longitude: response?.liveLocation[0],
    };
    // console.log('get-driver-location >> response :>> ', response);
    return res.status(200).send({
      message: 'Fetched driver-location successfully.',
      data: driverLocation,
    });
  } catch (error: any) {
    console.log('get-driver-location error: ', error);
    res.status(400).send({ error: error.message });
  }
}

export async function nearBydriver(req: Request, res: Response) {
  const body = req.body;
  const longitude = body.longitude;
  const latitude = body.latitude;
  try {
    if (!longitude || !latitude) {
      throw new Error('Both longitude and lattitude are required');
    }
    // const nearbyDriversDistanceInKm: any =getUtilsDataa().nearbyDriversDistanceInKm
    // console.log('nearbyDriversDistanceInKm',nearbyDriversDistanceInKm )
    const utilsdata = getUtils();
    const nearbyDriversDistanceInKm: any = utilsdata.nearbyDriversDistanceInKm;
    if (!nearbyDriversDistanceInKm) {
      throw new Error('nearbyDriversDistanceInKm is required');
    }
    const nearbyDriversDistanceInRadians = nearbyDriversDistanceInKm / 111.12; // Note: One degree is approximately 111.12 kilometers.

    // find drivers available to accept new ride
    const availableDrivers = await Driver.find(
      {
        rideStatus: 'online', // is acceptingRides(online) or not (offline)
        status: 'active', // drivers current ride status i.e if on a ride(on-ride) or free(active)
        liveLocation: {
          // $near: [72.9656312, 19.1649861],
          $near: [longitude, latitude],
          $maxDistance: nearbyDriversDistanceInRadians,
        },
      },
      { liveLocation: 1 },
    )
      .limit(20)
      .lean();
    // console.log('availableDrivers', availableDrivers);
    return res.status(200).send({
      message: 'All nearby available drivers',
      data: { availableDrivers },
    });
  } catch (err: any) {
    console.log('Fair error: ', err);
    res.status(400).send({ error: err.message });
  }
}

export async function updateLiveLocation(req: any, res: Response) {
  try {
    const driverId = req.decoded.user._id;
    const coordinates = req.body.coordinates;

    /// Update the driver's live location in the database
    const updateLocation: any = await Driver.findOneAndUpdate(
      {
        _id: driverId,
      },
      {
        liveLocation: coordinates,
      },
    );
    console.log(
      'updating-driver-live-location>>>>',
      updateLocation.liveLocation,
    );

    return res.status(200).send({
      message: 'Driver-location updated successfully.',
    });
  } catch (err: any) {
    console.log('err in live-location', err);
  }
}

export async function updateTimelineCoords(req: any, res: Response) {
  try {
    const driverId = req.decoded.user._id;
    const orderId: string = req.body.orderId;
    if (!orderId) {
      throw new Error('Order Id not Found');
    }
    let pathCoords: pathCoords[] | pathCoords = req.body.pathCoords;
    if (!Array.isArray(pathCoords)) {
      pathCoords = [pathCoords];
    }

    /// Update the driver's live location in the database
    const updateLocation: any = await Driver.findOneAndUpdate(
      {
        _id: driverId,
      },
      {
        liveLocation: pathCoords[pathCoords.length - 1].coords,
      },
    );

    // console.log('pathCoords===>', pathCoords);
    const updateTimeline: any = await Timeline.findOneAndUpdate(
      {
        driverId: new Types.ObjectId(driverId),
        orderId: new Types.ObjectId(orderId),
      },
      {
        $addToSet: { pathCoords: { $each: pathCoords } },
      },
      {
        upsert: true,
        new: true,
      },
    );

    const realPathcoords = await PlaceOrder.findOneAndUpdate(
      {
        _id: orderId,
      },
      {
        $push: { realPath: pathCoords[pathCoords.length - 1].coords },
      },
    );

    console.log(
      'updateTimelineCoords>>>',
      pathCoords[pathCoords.length - 1].coords,
      orderId,
    );

    return res.status(200).send({
      message: 'Driver-Timeline updated successfully.',
    });
  } catch (err: any) {
    console.log('err in Timeline', err.message);
    return res.status(400).send(err.message || err);
  }
}

export async function updateFcmToken(req: any, res: Response) {
  try {
    const token = req.body.token;
    const userId = req.decoded.user._id;

    if (!token) {
      throw new Error('device Token not found.');
    }

    await Driver.findOneAndUpdate(
      { _id: userId },
      {
        deviceToken: token,
      },
    ).lean();

    res.status(200).send({
      message: 'FCM Token updated successfully',
    });
  } catch (error: any) {
    console.log('error while update FCM Token', error);
  }
}

export function getDriverDetails(req: any) {
  return Driver.findOne(req).lean();
}
