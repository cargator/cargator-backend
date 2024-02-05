import { apps } from '../models';
import { Request, Response } from 'express';
import mongoose from 'mongoose';

export async function createApp(req: Request, res: Response) {
  let session: any;
  try {
    session = await mongoose.startSession();
    session.startTransaction();

    const { name , profileImageKey} = req.body;

    const fareRes = await apps.create(
      [
        {
          name,
          profileImageKey
        },
      ],
      { session: session },
    );

    if (!fareRes) {
      throw new Error('Error while getting fare');
    }

    await session.commitTransaction();
    res.status(200).send({
      message: ' App Updated Successfully.',
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

export async function getAppValue(req: Request, res: Response) {
  let session: any;
  try {
    session = await mongoose.startSession();
    session.startTransaction();

    const fareRes = await apps.find({});

    await session.commitTransaction();
    res.status(200).send({
      message: 'App data saved.',
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

export async function upDateAppValue(req: Request, res: Response) {
  let session: any;
  try {
    session = await mongoose.startSession();
    session.startTransaction();

    const id = req.params.uid;

    const faresRes = await apps.findOneAndUpdate(
      { _id: id },
      {
        name: req.body.name,
        profileImageKey: req.body.profileImageKey
      },
      { new: true },
    );

    await session.commitTransaction();
    res.status(200).send({
      message: 'App updated successfully.',
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
