import { Request, Response } from 'express';
import { LogActivity } from '../models/logActivity.model';

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
