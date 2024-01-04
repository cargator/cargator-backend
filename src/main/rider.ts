import { Riders } from '../models';
import { Request, Response } from 'express';
import mongoose from 'mongoose';

const getSearchRiders = async (req: Request) => {
  try {
    const page: any = req?.query?.page;
    const limit: any = req.query.limit;
    const dataLimit = parseInt(limit);
    const query = req.query.query;
    const skip = (parseInt(page) - 1) * dataLimit;
    const currentRides = await Riders.aggregate([
      {
        $facet: {
          data: [
            {
              $addFields: {
                totalRidesStr: { $toString: '$totalRidesCompleted' },
              },
            },
            {
              $match: {
                $or: [
                  {
                    name: {
                      $regex: new RegExp(`^${query}`, 'i'),
                    },
                  },
                  {
                    mobileNumber: {
                      $regex: new RegExp(`^${query}`, 'i'),
                    },
                  },
                  {
                    totalRidesStr: {
                      $regex: new RegExp(`^${query}`, 'i'),
                    },
                  },
                ],
              },
            },
            {
              $project: {
                _id: 1, // Include the _id field
                name: 1,
                mobileNumber: 1,
                totalRidesCompleted: 1,
                totalRidesStr: 1,
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
                    name: {
                      $regex: new RegExp(`^${query}`, 'i'),
                    },
                  },
                  {
                    mobileNumber: {
                      $regex: new RegExp(`^${query}`, 'i'),
                    },
                  },
                  {
                    totalRidesStr: {
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

export async function deleteRider(req: Request, res: Response) {
  let session: any;
  try {
    session = await mongoose.startSession();
    const id = req.params.uid;
    // console.log(`deleteRider >> id :>> `, id);

    session.startTransaction();

    const deleteRider = await Riders.findByIdAndDelete(id, {
      session: session,
    });

    if (!deleteRider) {
      throw new Error('Rider not found while deleting !');
    }

    await session.commitTransaction();
    res.status(200).send({
      success: true,
      message: 'Rider deleted successfully.',
    });
  } catch (error: any) {
    console.log(`deleteRider error :>> `, error);
    res.status(400).send({ success: false, message: error.message });
    if (session) {
      await session.abortTransaction();
    }
  } finally {
    await session.endSession();
  }
}

export async function updateRiderStatus(req: Request, res: Response) {
  let session: any;
  try {
    session = await mongoose.startSession();
    const { id, status } = req.body;
    const newStatus = status === 'active' ? 'inactive' : 'active';

    session.startTransaction();
    const updatedRider = await Riders.findOneAndUpdate(
      { _id: id, status },
      { status: newStatus },
      { session: session, new: true },
    );
    // console.log('updatedRider :>> ', updatedRider);
    if (!updatedRider) {
      throw new Error('Rider not found !');
    }

    await session.commitTransaction();
    res.status(200).send({
      success: true,
      message: 'Rider status updated successfully',
      data: updatedRider,
    });
  } catch (error: any) {
    res.status(400).send({ success: false, message: error.message });
    if (session) {
      await session.abortTransaction();
    }
  } finally {
    if (session) {
      await session.endSession();
    }
  }
}

export async function searchRidersByName(req: Request, res: Response) {
  try {
    const allRiders = await getSearchRiders(req);

    res.status(200).send({
      message: 'searched riders successfully.',
      data: allRiders,
    });
  } catch (error: any) {
    console.log(`search-riders-by-name error :>> `, error);
    res.status(400).send({ success: false, message: error.message });
  }
}

export async function getAllRiders(req: Request, res: Response) {
  try {
    const page: any = req?.query?.page;
    const limit: any = req.query.limit;
    const dataLimit = parseInt(limit);
    const skip = (parseInt(page) - 1) * dataLimit;
    console.log('??????????get all rider', page, dataLimit, skip);
    const allRidersDocs = await Riders.aggregate([
      {
        $facet: {
          riders: [
            { $sort: { updatedAt: -1 } },
            { $skip: skip },
            { $limit: dataLimit },
          ],
          totalRiders: [{ $count: 'count' }],
        },
      },
    ]);

    const totalRiders = allRidersDocs[0]['totalRiders'][0]['count'];
    return res.status(200).send({
      message: 'Fetched all riders successfully.',
      data: allRidersDocs[0]['riders'],
      totalRiders,
    });
  } catch (error: any) {
    console.log('get-all-riders error: ', error);
    res.status(400).send({ error: error.message });
  }
}

export async function addProfileDetails(req: Request, res: Response) {
  try {
    const name = req.body.values.firstName + ' ' + req.body.values.lastName;
    const resp = await Riders.findByIdAndUpdate(
      req.body.userId,
      { name },
      { new: true },
    );
    return res.status(200).send({
      message: 'Rider details update successfully',
      data: resp,
    });
  } catch (error: any) {
    console.log('error', error.message);
    res.status(400).send({ message: error.message });
  }
}

export async function getRiderById(req: Request, res: Response) {
  try {
    const riderId = req.params.id;
    const riderData = await Riders.findById(riderId);
    if (!riderData) {
      throw new Error('Error while fetching data, invalid id');
    }
    res.status(200).json({
      message: 'fetched driver data successfully',
      data: riderData,
    });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
}
