import mongoose from 'mongoose';
import { Flows } from '../models';
import { Request, Response } from 'express';

export async function createBreakPoints(req: Request, res: Response) {
  let session: any;
  try {
    const { BreakPoints, Sequence } = req.body;

    session = await mongoose.startSession();
    session.startTransaction();

    // Find all breakpoints with sequence number greater than or equal to the given sequence
    const existingBreakPoint = await Flows.findOne({
      sequenceNo: Sequence,
    });

    if (existingBreakPoint) {
      const updatedBreakPoints = await Flows.updateMany(
        { sequenceNo: { $gte: Sequence } },
        { $inc: { sequenceNo: 1 } },
        { session },
      );
    }
    // Create the new breakpoint with the specified sequence
    const reponses = await Flows.create(
      [
        {
          breakingPointName: BreakPoints,
          sequenceNo: Sequence,
        },
      ],
      { session },
    );

    await session.commitTransaction();

    res.status(200).send({
      message: ' breakPoint has been created.',
    });
  } catch (error: any) {
    if (session) {
      await session.abortTransaction();
    }
    res.status(400).json({ success: false, message: error.message });
  } finally {
    if (session) {
      await session.endSession();
    }
  }
}

export async function getBreakingPoints(req: Request, res: Response) {
  try {
    const page: any = req?.query?.page;
    const limit: any = req.query.limit;
    const dataLimit = parseInt(limit);
    const skip = (page - 1) * limit;
    const breakPoints = await Flows.aggregate([
      {
        $facet: {
          data: [
            {
              // $sort: { createdAt: -1 },
              $sort: { sequenceNo: 1 }, // Sort by sequenceNo in ascending order
            },
            {
              $skip: skip,
            },
            {
              $limit: dataLimit,
            },
          ],
          count: [{ $count: 'totalcount' }],
        },
      },
    ]);
    // console.log(spotList)
    return res.status(200).json({
      message: 'Fetched all BreakingPoints',
      data: breakPoints,
    });
  } catch (error: any) {
    console.log('get all breakPoints error: ', error);
    res.status(400).send({ error: error.message });
  }
}

export async function getBreakingPointsMobile(req: Request, res: Response) {
  try {
    const breakPoints = await Flows.find().sort({ sequenceNo: 1 });
    // console.log(spotList)
    return res.status(200).json({
      message: 'Fetched all BreakingPoints',
      data: breakPoints,
    });
  } catch (error: any) {
    console.log('get all breakPoints error: ', error);
    res.status(400).send({ error: error.message });
  }
}

export async function deleteBreakingPoints(req: Request, res: Response) {
  let session: any;
  try {
    session = await mongoose.startSession();
    session.startTransaction();

    const id = req.params.id;

    const deleteType: any = await Flows.findOneAndDelete({ _id: id });

    const sequenceNo = deleteType.sequenceNo;

    await Flows.updateMany(
      { sequenceNo: { $gte: sequenceNo } },
      { $inc: { sequenceNo: -1 } },
      { session },
    );

    if (!deleteType) {
      throw new Error('Error while deleting breakingPoints');
    }

    await session.commitTransaction();
    res.status(200).send({
      message: ' breakingPoint deleted Successfully.',
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

export async function updateBreakPoints(req: Request, res: Response) {
  let session: any;
  try {
    session = await mongoose.startSession();
    session.startTransaction();

    const id = req.params.id;

    const existingBreakPoint: any = await Flows.findOne({
      sequenceNo: req.body.Sequence,
    });

    if (existingBreakPoint && existingBreakPoint._id.toString() !== id) {
      throw new Error('breaking point already exist ');
    }

    const breakPoints = await Flows.findOneAndUpdate(
      { _id: id },

      {
        breakingPointName: req.body.BreakPoints,
        sequenceNo: req.body.Sequence,
      },
      { new: true },
    );

    if (!breakPoints) {
      throw new Error('Error while getting ');
    }

    await session.commitTransaction();
    res.status(200).send({
      message: ' breakPoints Type Updated Successfully.',
      data: breakPoints,
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

export async function getBreakPointOne(req: Request, res: Response) {
  let session: any;
  try {
    session = await mongoose.startSession();
    session.startTransaction();

    const id = req.params.id;

    const breakPoint = await Flows.findById({ _id: id });

    if (!breakPoint) {
      throw new Error('Error while getting breakpoints');
    }

    await session.commitTransaction();
    res.status(200).send({
      message: ' Vehicle Type deleted Successfully.',
      data: breakPoint,
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
