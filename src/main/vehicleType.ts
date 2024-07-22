import { VehicleTypes } from '../models';
import { Request, Response } from 'express';
import mongoose from 'mongoose';

export async function getVehicleType(req: Request, res: Response) {
  try {
    const vehiclesType = await VehicleTypes.find().sort({
      vehicleMake: 1,
      vehicleModel: 1,
    });

    res.status(200).send({
      message: 'Vehicle Type data retrieved successfully.',
      data: vehiclesType,
    });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
    console.error('Error:', error);
  }
}

export async function deleteVehicleType(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const deleteResult = await VehicleTypes.deleteOne({ _id: id });

    if (deleteResult.deletedCount === 0) {
      throw new Error('VehicleType not found or already deleted');
    }

    res.status(200).send({
      message: 'Vehicle Type deleted successfully.',
      data: deleteResult,
    });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
    console.error('Error:', error);
  }
}

export async function getVehicleOne(req: Request, res: Response) {
  try {
    const { id } = req.params;

    const vehicleType = await VehicleTypes.findById(id);

    if (!vehicleType) {
      return res.status(404).json({
        success: false,
        message: 'Vehicle type not found',
      });
    }

    res.status(200).send({
      message: 'Vehicle type retrieved successfully.',
      data: vehicleType,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
    console.error('Error:', error.message);
  }
}

export async function updateVehicleType(req: Request, res: Response) {
  let session: any;
  try {
    session = await mongoose.startSession();
    session.startTransaction();

    const id = req.params.uid;

    const vehiclesType = await VehicleTypes.findOneAndUpdate(
      { _id: id },
      {
        vehicleType: req.body.vehicleType,
        vehicleMake: req.body.vehicleMake,
        vehicleModel: req.body.vehicleModel,
      },
      { new: true },
    );

    if (!vehiclesType) {
      throw new Error('Error while getting vehicleType');
    }

    await session.commitTransaction();
    res.status(200).send({
      message: ' Vehicle Type Updated Successfully.',
      data: vehiclesType,
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

export async function createVehicleType(req: Request, res: Response) {
  let session: any;
  try {
    session = await mongoose.startSession();
    const { vehicleType, vehicleMake, vehicleModel } = req.body;
    // console.log('object1 :>> ');
    session.startTransaction();

    const driver = await VehicleTypes.create(
      [
        {
          vehicleType,
          vehicleMake,
          vehicleModel,
        },
      ],
      { session: session },
    );

    if (driver.length == 0) {
      throw new Error('Error while creating vehicleType');
    }

    await session.commitTransaction();
    res.status(200).send({
      message: ' Vehicle Type data saved.',
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
