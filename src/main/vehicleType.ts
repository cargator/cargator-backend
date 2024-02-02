import { VehicleTypes } from '../models';
import { Request, Response } from 'express';
import mongoose from 'mongoose';

export async function getVehicleType(req: Request, res: Response) {
    let session: any;
    try {
      session = await mongoose.startSession();
      session.startTransaction();
  
      const vehiclesType = await VehicleTypes.find({});
  
    //   if (vehiclesType.length == 0) {
    //     throw new Error('Error while getting vehicleType');
    //   }

      await session.commitTransaction();
      res.status(200).send({
        message: ' Vehicle Type data saved.',
        data: vehiclesType
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

  export async function deleteVehicleType(req: Request, res: Response) {
    let session: any;
    try {
      session = await mongoose.startSession();
      session.startTransaction();
      
      const id = req.params.id;

      const deleteType = await VehicleTypes.deleteOne({"_id":id});
  
      if (!deleteType) {
        throw new Error('Error while deleting vehicleType');
      }

      await session.commitTransaction();
      res.status(200).send({
        message: ' Vehicle Type deleted Successfully.',
        data: deleteType
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

  export async function getVehicleOne(req: Request, res: Response) {
    let session: any;
    try {
      session = await mongoose.startSession();
      session.startTransaction();
      
      const id = req.params.id;

      const vehiclesType = await VehicleTypes.findById({"_id":id});
  
      if (!vehiclesType) {
        throw new Error('Error while getting vehicleType');
      }

      await session.commitTransaction();
      res.status(200).send({
        message: ' Vehicle Type deleted Successfully.',
        data: vehiclesType
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

  export async function updateVehicleType(req: Request, res: Response) {
    let session: any;
    try {
      session = await mongoose.startSession();
      session.startTransaction();
      
      const id = req.params.uid;

      const vehiclesType = await VehicleTypes.findOneAndUpdate({_id:id},
      {
        vehicleType:req.body.vehicleType
      },
      {new:true});
  
      if (!vehiclesType) {
        throw new Error('Error while getting vehicleType');
      }

      await session.commitTransaction();
      res.status(200).send({
        message: ' Vehicle Type Updated Successfully.',
        data: vehiclesType
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
      const {
        vehicleType,
      } = req.body;
      // console.log('object1 :>> ');
      session.startTransaction();
  
      const driver = await VehicleTypes.create(
        [
          {
            vehicleType,
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