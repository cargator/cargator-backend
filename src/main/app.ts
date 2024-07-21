import { DriverAppFlow, apps } from '../models';
import { Request, Response } from 'express';
import mongoose from 'mongoose';

export async function createApp(req: Request, res: Response) {
  let session: any;
  try {
    session = await mongoose.startSession();
    session.startTransaction();

    const { name, profileImageKey } = req.body;

    const fareRes = await apps.create(
      [
        {
          name,
          profileImageKey,
        },
      ],
      { session: session },
    );

    if (!fareRes) {
      throw new Error('Error while getting app name and logo');
    }

    await session.commitTransaction();
    res.status(200).send({
      message: ' App name and logo updated successfully.',
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
      message: 'App name and logo data saved.',
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
        profileImageKey: req.body.profileImageKey,
      },
      { new: true },
    );

    await session.commitTransaction();
    res.status(200).send({
      message: 'App name and logo updated successfully.',
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

// function for driver Application flow

export async function createDriverAppFlow(req: Request, res: Response) {
  let session: any;
  try {
    session = await mongoose.startSession();
    session.startTransaction();

    const { selectedFlowOption } = req.body;
    console.log('object', selectedFlowOption);

    const flowres = await DriverAppFlow.create(
      [
        {
          applicationFLow: selectedFlowOption,
        },
      ],
      { session: session },
    );

    if (!flowres) {
      throw new Error('Error while creating application flow');
    }

    await session.commitTransaction();
    res.status(200).send({
      message: ' App Flow craeted successfully.',
      data: flowres,
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

export async function updateAppFlow(req: Request, res: Response) {
  let session: any;
  try {
    session = await mongoose.startSession();
    session.startTransaction();

    const id = req.params.id;

    const flowRes = await DriverAppFlow.findOneAndUpdate(
      { _id: id },
      {
        applicationFLow: req.body.selectedFlowOption,
      },
      { new: true },
    );

    await session.commitTransaction();
    res.status(200).send({
      message: 'App flow updated successfully.',
      data: flowRes,
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

export async function getAppFlowMobile(req: Request, res: Response) {
  let session: any;
  try {
    session = await mongoose.startSession();
    session.startTransaction();

    const flowRes = await DriverAppFlow.find({});

    await session.commitTransaction();
    res.status(200).send({
      message: 'App Flow got successfully.',
      data: flowRes,
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

export async function getCurrentFlow(req: Request, res: Response) {
  try {
    console.log(
      JSON.stringify({
        method: 'getCurrentFlow',
      }),
    );

    const response = await getAppFLow();
    console.log(
      JSON.stringify({
        method: 'getCurrentFlow',
        data: response,
      }),
    );

    res.status(200).send({
      message: 'App Flow got successfully.',
      data: response,
    });
  } catch (error: any) {
    console.log({
      method: 'getCurrentFlow',
      error: error,
    });
    res.status(400).json({ success: false, message: error.message });
  }
}

export function getAppFLow() {
  return DriverAppFlow.findOne().lean()
}
