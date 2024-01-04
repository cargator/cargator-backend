import { Request, Response } from 'express';
import { Rides } from '../models';
import mongoose, { Types } from 'mongoose';

export async function getRidesByFilters(req: Request, res: Response) {
  try {
    console.log('check');
    const page: any = req?.query?.page;
    const limit: any = req.query.limit;
    const dataLimit = parseInt(limit);
    const filter = req.query.filter;
    console.log('filter', filter, req.query);
    const skip = (parseInt(page) - 1) * dataLimit;
    const response = await Rides.aggregate([
      {
        $facet: {
          data: [
            {
              $match: {status: filter},
            },
            {
              $lookup: {
                from: 'drivers', // Target collection name
                localField: 'driverId', // Field from the local collection
                foreignField: '_id', // Field from the target collection
                as: 'driverDetails',
              },
            },
            {
              $lookup: {
                from: 'riders', // Target collection name
                localField: 'riderId', // Field from the local collection
                foreignField: '_id', // Field from the target collection
                as: 'riderDetails',
              },
            },
            {
              $project: {
                _id: 1, // Include the _id field
                pickUpAddress: 1, // Include the title field from the Post collection
                dropAddress: 1,
                status: 1,
                fare: 1,
                createdAt: 1,
                'driverDetails.mobileNumber': 1, // Include the name field from the User collection
                'riderDetails.mobileNumber': 1, // Include the email field from the User collection
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
              $match: {status: filter},
            },

            { $count: 'totalcount' },
          ],
        },
      },
    ]);
    return res.status(200).json({
      message: 'fetch rides by filter',
      data: response,
    });
  } catch (error: any) {
    console.log('get-rides-by-filter error: ', error);
    // res.status(400).send({ error: error.message });
  }
}

export async function getAllRide(req: Request, res: Response) {
  try {
    const page: any = req?.query?.page;
    const limit: any = req.query.limit;
    const dataLimit = parseInt(limit);
    const skip = (page - 1) * limit;
    const allRidesData = await Rides.aggregate([
      {
        $facet: {
          data: [
            {
              $sort: { createdAt: -1 },
            },
            {
              $skip: skip,
            },
            {
              $limit: dataLimit,
            },
            {
              $lookup: {
                from: 'drivers', // Target collection name
                localField: 'driverId', // Field from the local collection
                foreignField: '_id', // Field from the target collection
                as: 'driverDetails',
              },
            },
            {
              $lookup: {
                from: 'riders', // Target collection name
                localField: 'riderId', // Field from the local collection
                foreignField: '_id', // Field from the target collection
                as: 'riderDetails',
              },
            },
            {
              $project: {
                _id: 1, // Include the _id field
                pickUpAddress: 1, // Include the title field from the Post collection
                dropAddress: 1,
                status: 1,
                fare: 1,
                createdAt: 1,
                'driverDetails.mobileNumber': 1, // Include the name field from the User collection
                'riderDetails.mobileNumber': 1, // Include the email field from the User collection
              },
            },
          ],
          count: [{ $count: 'totalcount' }],
        },
      },
    ]);
    return res.status(200).json({
      message: 'Fetched all rides',
      data: allRidesData,
    });
  } catch (error: any) {
    console.log('get all rides error: ', error);
    // res.status(400).send({ error: error.message });
  }
}

export async function getRideDetail(req: Request, res: Response) {
  try {
    const objectId = new mongoose.Types.ObjectId(req.params.id);

    const response = await Rides.aggregate([
      {
        $match: {
          _id: objectId,
        },
      },
      {
        $lookup: {
          from: 'drivers', // Target collection name
          localField: 'driverId', // Field from the local collection
          foreignField: '_id', // Field from the target collection
          as: 'driverDetails',
        },
      },
      {
        $lookup: {
          from: 'riders', // Target collection name
          localField: 'riderId', // Field from the local collection
          foreignField: '_id', // Field from the target collection
          as: 'riderDetails',
        },
      },
      {
        $lookup: {
          from: 'vehicles', // Target collection name
          localField: 'vehicleNumber', // Field from the local collection
          foreignField: 'vehicleNumber', // Field from the target collection
          as: 'vehicleDetails',
        },
      },
    ]);
    console.log('get-ride-detail log??????', response);

    if (response?.length == 0) {
      throw new Error('Ride not found');
    }
    return res.status(200).send({
      message: 'Fetched ride details successfully.',
      data: response,
    });
  } catch (error: any) {
    console.log('get ride details error: ', error);
    res.status(400).send({ error: error.message });
  }
}

export async function getCurrentRide(req: Request, res: Response) {
  try {
    const page: any = req?.query?.page;
    const limit: any = req.query.limit;
    const dataLimit = parseInt(limit);
    const skip = (parseInt(page) - 1) * dataLimit;
    const response = await Rides.aggregate([
      {
        $facet: {
          data: [
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
            {
              $lookup: {
                from: 'drivers', // Target collection name
                localField: 'driverId', // Field from the local collection
                foreignField: '_id', // Field from the target collection
                as: 'driverDetails',
              },
            },
            {
              $lookup: {
                from: 'riders', // Target collection name
                localField: 'riderId', // Field from the local collection
                foreignField: '_id', // Field from the target collection
                as: 'riderDetails',
              },
            },
            {
              $project: {
                _id: 1, // Include the _id field
                pickUpAddress: 1, // Include the title field from the Post collection
                dropAddress: 1,
                status: 1,
                fare: 1,
                createdAt: 1,
                'driverDetails.mobileNumber': 1, // Include the name field from the User collection
                'riderDetails.mobileNumber': 1, // Include the email field from the User collection
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
            { $count: 'totalcount' },
          ],
        },
      },
    ]);
    return res.status(200).json({
      message: 'fetch Ongoing rides',
      data: response,
    });
  } catch (error: any) {
    console.log('get-current-rides error: ', error);
    // res.status(400).send({ error: error.message });
  }
}

export async function searchRide(req: Request, res: Response) {
  try {
    const page: any = req?.query?.page;
    const limit: any = req.query.limit;
    const dataLimit = parseInt(limit);
    console.log('datalimit', typeof limit, typeof dataLimit);
    const query = req.query.query;
    const skip = (parseInt(page) - 1) * dataLimit;
    const response: any = await Rides.aggregate([
      {
        $facet: {
          data: [
            {
              $addFields: {
                fareStr: { $toString: '$fare' },
                createdAtStr: { $toString: '$createdAt' },
              },
            },
            {
              $match: {
                $or: [
                  {
                    pickUpAddress: {
                      $regex: new RegExp(`^${query}`, 'i'),
                    },
                  },
                  {
                    dropAddress: {
                      $regex: new RegExp(`^${query}`, 'i'),
                    },
                  },
                  { status: { $regex: new RegExp(`^${query}`, 'i') } },
                  {
                    fareStr: { $regex: new RegExp(`^${query}`, 'i') },
                  },
                  {
                    createdAtStr: {
                      $regex: new RegExp(`${query}`, 'i'),
                    },
                  },
                  {
                    'driverDetails.mobileNumber': {
                      $regex: new RegExp(`^${query}`, 'i'),
                    },
                  },
                  {
                    'riderDetails.mobileNumber': {
                      $regex: new RegExp(`^${query}`, 'i'),
                    },
                  },
                ],
              },
            },
            {
              $lookup: {
                from: 'drivers', // Target collection name
                localField: 'driverId', // Field from the local collection
                foreignField: '_id', // Field from the target collection
                as: 'driverDetails',
              },
            },
            {
              $lookup: {
                from: 'riders', // Target collection name
                localField: 'riderId', // Field from the local collection
                foreignField: '_id', // Field from the target collection
                as: 'riderDetails',
              },
            },
            {
              $project: {
                _id: 1, // Include the _id field
                pickUpAddress: 1, // Include the title field from the Post collection
                dropAddress: 1,
                status: 1,
                fare: 1,
                fareStr: 1,
                createdAt: 1,
                createdAtStr: 1,
                'driverDetails.mobileNumber': 1, // Include the name field from the User collection
                'riderDetails.mobileNumber': 1, // Include the email field from the User collection
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
                    pickUpAddress: {
                      $regex: new RegExp(`^${query}`, 'i'),
                    },
                  },
                  {
                    dropAddress: {
                      $regex: new RegExp(`^${query}`, 'i'),
                    },
                  },
                  { status: { $regex: new RegExp(`^${query}`, 'i') } },
                  {
                    fareStr: { $regex: new RegExp(`^${query}`, 'i') },
                  },
                  {
                    createdAtStr: {
                      $regex: new RegExp(`${query}`, 'i'),
                    },
                  },
                  {
                    'driverDetails.mobileNumber': {
                      $regex: new RegExp(`^${query}`, 'i'),
                    },
                  },
                  {
                    'riderDetails.mobileNumber': {
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
    return res.status(200).json({
      message: 'search rides',
      data: response,
    });
  } catch (error: any) {
    console.log('get-search-rides error: ', error);
  }
}

export async function getRideHistory(req: Request, res: Response) {
  try {
    const id = req.params.id;
    const type = req.body.type;
    let allRides;

    if (type == 'rider') {
      allRides = await Rides.find({
        riderId: id,
      }).sort({ createdAt: -1 });
    }

    if (type == 'driver') {
      allRides = await Rides.find({
        driverId: id,
      }).sort({ createdAt: -1 });
    }
    return res.status(200).send({
      message: 'Fetched ride history successfully.',
      data: allRides,
    });
  } catch (error: any) {
    console.log('getRideHistory', error.message);
    res.status(400).send({ error: error.message });
  }
}

export async function getAllScheduleRides(req: Request, res: Response) {
  try {
    const riderId = req.params.riderId;
    const response = await Rides.find({
      riderId: new Types.ObjectId(riderId),
      status: 'pending-accept',
      bookingTime: { $exists: true },
    })
      .lean()
      .sort({ bookingTime: 1 });
    return res.status(200).send({
      message: 'Scheduled ride fetched successfully.',
      data: response,
    });
  } catch (error: any) {
    console.log('getAllScheduleRides error', error.message);
    res.status(400).send({ error: error.message });
  }
}

export async function cancelScheduledRide(req: Request, res: Response) {
  try {
    const rideId = req.body.rideId;
    const rideDoc = await Rides.findByIdAndUpdate(
      rideId,
      { status: 'cancelled' },
      { new: true },
    );
    if (!rideDoc) {
      throw new Error('No scheduled-ride found!');
    }
    return res.status(200).send({
      status: true,
      message: 'Scheduled-ride deleted successfully.',
    });
  } catch (error: any) {
    console.log('error', error.message);
    res.status(400).send({ success: false, message: error.message });
  }
}
