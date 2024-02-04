import { fares } from '../models';
import { Request, Response } from 'express';
import mongoose from 'mongoose';

export async function createFare(req: Request, res: Response) {
  let session: any;
  try {
    session = await mongoose.startSession();
    session.startTransaction();

    const { fare } = req.body;

    const fareRes = await fares.create(
      [
        {
          fare,
        },
      ],
      { session: session },
    );

    if (!fareRes) {
      throw new Error('Error while getting fare');
    }

    await session.commitTransaction();
    res.status(200).send({
      message: ' Vehicle Type Updated Successfully.',
      data: fareRes,
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

export async function getFareValue(req: Request, res: Response) {
  let session: any;
  try {
    session = await mongoose.startSession();
    session.startTransaction();

    const fareRes = await fares.find({});

    await session.commitTransaction();
    res.status(200).send({
      message: ' Vehicle Type data saved.',
      data: fareRes,
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

export async function upDateFareValue(req: Request, res: Response) {
  let session: any;
  try {
    session = await mongoose.startSession();
    session.startTransaction();

    const id = req.params.uid;

    const faresRes = await fares.findOneAndUpdate(
      { _id: id },
      {
        fare: req.body.fare,
      },
      { new: true },
    );

    await session.commitTransaction();
    res.status(200).send({
      message: 'Fare updated successfully.',
      data: faresRes,
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
