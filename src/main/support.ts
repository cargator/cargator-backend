import { Request, Response } from 'express';
import { LogActivity } from '../models/logActivity.model';
import { Utils } from '../models';
import { getSignedUrlForS3 } from '../config/aws.config';

export async function getActivities(req: Request, res: Response) {
  try {
    const page: number = parseInt(req.query.page as string, 10) || 1;
    const limit: number = parseInt(req.query.limit as string, 10) || 10;
    const skip = (page - 1) * limit;

    const activityDoc = await LogActivity.aggregate([
      {
        $facet: {
          activity: [
            {
              $lookup: {
                from: 'admins',
                let: { admin_id: '$admin_id' },
                pipeline: [
                  {
                    $match: {
                      $expr: {
                        $eq: ['$_id', '$$admin_id'],
                      },
                    },
                  },
                  {
                    $project: {
                      name: 1,
                      mobile_Number: 1,
                    },
                  },
                ],
                as: 'admin',
              },
            },
            {
              $unwind: '$admin',
            },
            {
              $sort: { updatedAt: -1 },
            },
            {
              $skip: skip,
            },
            {
              $limit: limit,
            },
          ],
          count: [
            {
              $count: 'totalCount',
            },
          ],
        },
      },
    ]);
    return res.status(200).send({
      message: 'success',
      data: activityDoc[0],
    });
  } catch (error: any) {
    console.log(`get-activities error :>> `, error);
    return res.status(400).send({ message: error.message });
  }
}

export async function getActivityData(req: Request, res: Response) {
  try {
    const activityDoc = await LogActivity.find({ _id: req.params.id }).lean();
    return res.status(200).send({
      message: 'success',
      data: activityDoc,
    });
  } catch (error: any) {
    console.log(`get-activities error :>> `, error);
    return res.status(400).send({ message: error.message });
  }
}

export async function updateAppImage(req: Request, res: Response) {
  try {
    await Utils.findOneAndUpdate(
      { _id: req.params.id },
      { appImageKey: req.body.appImageKey },
    );
    return res.status(200).send({ message: 'success' });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
    console.log('update-app-image :>> ', error);
  }
}

export async function updateCurrentMap(req: Request, res: Response) {
  try {
    const id = req.params.id;

    // Rename the result from Utils.findOneAndUpdate to avoid conflict with Express's res
    const result: any = await Utils.findOneAndUpdate(
      { _id: id },
      {
        currentMap: req.body.selectedMapOption,
      },
      { new: true },
    );

    if (!result) {
      throw new Error('current map not found!');
    }

    console.log(
      JSON.stringify({
        method: 'updateCurrentMap',
        data: result,
      }),
    );

    res.status(200).send({
      message: 'Current map updated successfully.',
    });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
    console.log('err :>> ', error);
  }
}

export async function getCurrentMap(req: Request, res: Response) {
  try {
    const response = await Utils.findOne();

    // console.log(
    //   JSON.stringify({
    //     method: 'getCurrentMap',
    //     data: response,
    //   }),
    // );

    res.status(200).send({
      message: 'current Map got successfully.',
      data: response,
    });
  } catch (error: any) {
    console.log({
      method: 'getCurrentMap',
      error: error,
    });
    res.status(400).json({ success: false, message: error.message });
  }
}
