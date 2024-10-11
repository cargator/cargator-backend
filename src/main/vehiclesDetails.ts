import { Vehicles } from '../models';
import { Driver } from '../models/driver.model';
import { Request, Response } from 'express';
import mongoose from 'mongoose';
import environmentVars from '../constantsVars';
const AWS = require('aws-sdk');
AWS.config.update({
  region: environmentVars.AWS_REGION,
  accessKeyId: environmentVars.AWS_ACCESS_KEY_ID,
  secretAccessKey: environmentVars.AWS_SECRET_ACCESS_KEY,
});

export async function searchVehicles(req: Request, res: Response) {
  try {
    const page: any = req?.query?.page;
    const limit: any = req.query.limit;
    const dataLimit = parseInt(limit);
    const search = req.query.query;
    const skip = (parseInt(page) - 1) * dataLimit;
    const allVehicles = await Vehicles.aggregate([
      {
        $facet: {
          data: [
            {
              $match: {
                $or: [
                  {
                    vehicleName: {
                      $regex: new RegExp(`^${search}`, 'i'),
                    },
                  },
                  {
                    vehicleNumber: {
                      $regex: new RegExp(`^${search}`, 'i'),
                    },
                  },
                  {
                    vehicleType: {
                      $regex: new RegExp(`^${search}`, 'i'),
                    },
                  },
                  {
                    vehicleStatus: {
                      $regex: new RegExp(`^${search}`, 'i'),
                    },
                  },
                ],
              },
            },
            {
              $project: {
                _id: 1, // Include the _id field
                vehicleName: 1,
                vehicleNumber: 1,
                vehicleType: 1,
                vehicleStatus: 1,
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
                    vehicleName: {
                      $regex: new RegExp(`^${search}`, 'i'),
                    },
                  },
                  {
                    vehicleNumber: {
                      $regex: new RegExp(`^${search}`, 'i'),
                    },
                  },
                  {
                    vehicleType: {
                      $regex: new RegExp(`^${search}`, 'i'),
                    },
                  },
                  {
                    vehicleStatus: {
                      $regex: new RegExp(`^${search}`, 'i'),
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
    res.status(200).json({
      message: 'fetched vehicle data successfully',
      data: allVehicles,
    });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
}

export async function getVehicleData(req: Request, res: Response) {
  try {
    const vehicleNumber: any = req.query.vehicleNo;
    const driverid = req.query.id;
    let vehicleData;
    if (driverid == undefined) {
      // console.log('object in if :>> ');
      vehicleData = await Vehicles.findOne({
        vehicleNumber: vehicleNumber.toUpperCase(),
        vehicleStatus: 'available',
      });
      if (!vehicleData) {
        throw new Error(
          'Vehicle not found, may be its assigned to another driver',
        );
      }
    } else {
      // console.log(' in else :>> ');
      const YourvehicleData = await Vehicles.findOne({
        vehicleNumber: vehicleNumber.toUpperCase(),
        vehicleStatus: 'unavailable',
        vehicleAssignedToId: driverid,
      });

      // console.log('object :>> YourvehicleData ', YourvehicleData);

      if (YourvehicleData) {
        return res.status(200).json({
          message: 'This vehicle is already assigned to you',
          data: YourvehicleData,
        });
      }
      vehicleData = await Vehicles.findOne({
        vehicleNumber: vehicleNumber.toUpperCase(),
        vehicleStatus: 'available',
      });
      if (!vehicleData) {
        throw new Error(
          'Vehicle not found, may be its assigned to another driver',
        );
      }
    }

    res.status(200).json({
      message: 'fetched vehicle data successfully',
      data: vehicleData,
    });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
}

export async function createVehicleData(req: Request, res: Response) {
  try {
    const {
      vehicleName,
      vehicleNumber,
      vehicleType,
      vehicleMake,
      vehicleModel,
      profileImageKey,
      documentsKey,
    } = req.body;

    // Validate required fields
    if (!vehicleName || !vehicleNumber || !vehicleType) {
      return res.status(400).json({
        success: false,
        message: 'Vehicle name, number, and type are required.',
      });
    }

    // Check if the vehicle number already exists
    const existingVehicle = await Vehicles.findOne({
      vehicleNumber: vehicleNumber.toUpperCase(),
    });
    if (existingVehicle) {
      return res.status(400).json({
        success: false,
        message: 'Vehicle number already exists.',
      });
    }

    // Create a new vehicle
    const newVehicle = await Vehicles.create({
      vehicleName,
      vehicleNumber: vehicleNumber.toUpperCase(),
      vehicleType,
      vehicleMake,
      vehicleModel,
      profileImageKey,
      documentsKey,
    });

    // Send success response
    res.status(201).send({
      message: 'Vehicle data saved successfully.',
      data: newVehicle,
    });
  } catch (error: any) {
    // Send error response
    res.status(500).json({
      success: false,
      message: 'An unexpected error occurred. Please try again later.',
    });

    // Log detailed error for debugging
    console.error('Error creating vehicle data:', error.message);
  }
}
export async function deleteVehicle(req: Request, res: Response) {
  try {
    const s3 = new AWS.S3();
    const vehicleId = req.params.uid;
    const body = {
      uid: req.params.id,
      profileImageKey: req.headers['x-profile-image-key'],
      documentsKey: req.headers['x-documents-key']
        ? req.headers['x-documents-key'][0]
        : undefined,
    };
    const vehicle = await Vehicles.findOneAndDelete({
      _id: vehicleId,
      vehicleStatus: 'available',
    });

    if (!vehicle) {
      throw new Error(
        'error while deleting vehicle, vehicle may be assigned to someone else',
      );
    }
    if (body?.profileImageKey !== undefined) {
      console.log('object image:>> ');
      const params = {
        Bucket: 'cargator',
        Key: body?.profileImageKey, // Replace with the key of the object you want to delete
      };

      s3.deleteObject(params, (err: any, data: any) => {
        if (err) {
          console.error('Error deleting object:', err);
        } else {
          console.log('Object deleted successfully', data);
        }
      });
    }
    if (Array.isArray(body?.documentsKey) && body?.documentsKey.length > 0) {
      console.log('object docs:>> ');
      body.documentsKey.forEach((element: string) => {
        const params = {
          Bucket: 'cargator',
          Key: element, // Replace with the key of the object you want to delete
        };

        s3.deleteObject(params, (err: any, data: any) => {
          if (err) {
            console.error('Error deleting object:', err);
          } else {
            console.log('Object deleted successfully', data);
          }
        });
      });
    }
    res.status(200).send({
      message: ' Vehicle data deleted.',
    });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
}

export async function updateVehicle(req: Request, res: Response) {
  let session: any;
  try {
    session = await mongoose.startSession();
    const {
      vehicleName,
      vehicleNumber,
      vehicleType,
      vehicleMake,
      vehicleModel,
      profileImageKey,
      documentsKey,
    } = req.body;
    const vehicleId = req.params.uid;
    session.startTransaction();
    const vehicle = await Vehicles.findOneAndUpdate(
      {
        _id: vehicleId,
      },
      {
        vehicleName,
        vehicleNumber: vehicleNumber.toUpperCase(),
        vehicleType,
        vehicleMake,
        vehicleModel,
        profileImageKey: profileImageKey,
        documentsKey: documentsKey,
      },
      { session: session },
    );

    if (!vehicle) {
      throw new Error('Vehicle data not found, Invalid Id');
    }

    if (vehicle.vehicleAssignedToId && vehicle.vehicleStatus == 'unavailable') {
      const driver = await Driver.findOneAndUpdate(
        {
          _id: vehicle.vehicleAssignedToId,
        },
        {
          vehicleName,
          vehicleNumber: vehicleNumber.toUpperCase(),
          vehicleType,
          vehicleMake,
          vehicleModel,
        },
        { session: session },
      );
    }

    await session.commitTransaction();
    res.status(200).send({
      message: 'updtaed vehicle data successfully',
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

export async function paginatedVehicleData(req: Request, res: Response) {
  try {
    const page: any = req?.query?.page;
    const limit: any = req.query.limit;
    const dataLimit = parseInt(limit);
    const skip = (parseInt(page) - 1) * dataLimit;
    const allVehicles = await Vehicles.aggregate([
      {
        $facet: {
          vehicles: [
            { $sort: { updatedAt: -1 } },
            { $skip: skip },
            { $limit: dataLimit },
          ],
          totalVehicles: [{ $count: 'count' }],
        },
      },
    ]);

    const totalVehicles = allVehicles[0]['totalVehicles'][0]['count'];

    if (!allVehicles || allVehicles.length === 0) {
      throw new Error('Vehicles not found');
    }

    return res.status(200).json({
      message: 'This vehicle is already assigned to you',
      data: allVehicles[0]['vehicles'],
      totalVehicles,
    });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
}

export async function getVehicleById(req: Request, res: Response) {
  try {
    const id = req.params.id;
    const vehicleData = await Vehicles.findById(id);
    if (!vehicleData) {
      throw new Error('Vehicle not found');
    }
    res.status(200).json({
      message: 'fetched vehicle data successfully',
      data: vehicleData,
    });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
}

export async function allAvailableVehicles(req: Request, res: Response) {
  try {
    const vehicleData = await Vehicles.find({
      vehicleStatus: 'available',
    });
    // console.log('vehicleData  allAvailableVehicles :>> ', vehicleData);
    if (!vehicleData) {
      throw new Error('Vehicles not found');
    }
    res.status(200).json({
      message: 'fetched vehicle data successfully',
      data: vehicleData,
    });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
}

export async function allAllVehicles(req: Request, res: Response) {
  try {
    const vehicleData = await Vehicles.find({});
    // console.log('vehicleData  allAvailableVehicles :>> ', vehicleData);
    if (!vehicleData) {
      throw new Error('Vehicles not found');
    }
    res.status(200).json({
      message: 'fetched vehicle data successfully',
      data: vehicleData,
    });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
}

export function getVehicalDetails(req: any) {
  return Vehicles.findOne(req);
}

export async function updateVehicleImageKey(req: Request, res: Response) {
  try {
    const { userId, imageKey, photoUri } = req.body;

    const keyDocs = {imageKey: imageKey, imageUri: photoUri}

    const response: any = await Vehicles.findOneAndUpdate(
      { vehicleAssignedToId: userId },
      { 
        documentsKey: keyDocs,
        profileImageKey: imageKey,
       },
      { new: true },
    ).lean();

    return res.status(200).json({
      message: 'vehicle image key uploaded successfully',
      data: response,
    });
  } catch (error: any) {
    console.error('get vehicle image key error: ', error);
    return res.status(500).json({
      message: 'Error when uploading vehicle image key ',
      error: error.message,
    });
  }
}
