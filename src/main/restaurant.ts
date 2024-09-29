import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { Restaurant } from '../models/reataurant.model';

export async function createRestaurant(req: Request, res: Response) {
  let session: any;
  try {
    session = await mongoose.startSession();
    const { restaurantName,bounds } = req.body;

    const restaurantNameToLowerCase = restaurantName.toLowerCase().trim();

    session.startTransaction();

    const checkStatus: any = await Restaurant.findOne(
      {
        restaurantName: restaurantName,
        restaurantNameToLowerCase: restaurantNameToLowerCase,
      },
      null,
      { session: session },
    );

    if (checkStatus) {
      throw new Error('Restaurant already exists');
    }

    const restaurant: any = await Restaurant.create(
      [
        {
          restaurantName: restaurantName,
          restaurantNameToLowerCase: restaurantNameToLowerCase,
          bounds,
        },
      ],
      { session: session },
    );

    if (restaurant.length == 0) {
      throw new Error("Error while creating Restaurant");
    }

    await session.commitTransaction();
    res.status(200).send({
      message: " Restaurant Created Successfully.",
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

export async function getRestaurantList(req: Request, res: Response) {
  try {
    const page: any = req?.query?.page;
    const limit: any = req.query.limit;
    // console.log("page",page)
    // console.log("limit",limit)restaurantName
    const dataLimit = parseInt(limit);
    const skip = (page - 1) * limit;
    const restaurantList = await Restaurant.aggregate([
      {
        $facet: {
          data: [
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
          count: [{ $count: 'totalcount' }],
        },
      },
    ]);
    // console.log(spotList)
    return res.status(200).json({
      message: 'Fetched all restaurants',
      data: restaurantList,
    });
  } catch (error: any) {
    console.log('get all restaurants error: ', error);
    // res.status(400).send({ error: error.message });
  }
}

export async function getAvailableRestaurant(req: Request, res: Response) {
  try {
    const restaurantList = await Restaurant.find();
    // console.log('vehicleData  allAvailableVehicles :>> ', vehicleData);
    if (!restaurantList) {
      throw new Error('restaurantList not found');
    }
    res.status(200).json({
      message: 'fetched Restaurant data successfully',
      data: restaurantList,
    });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
}

export async function deleteRestaurant(req: Request, res: Response) {
  let session: any;
  try {
    session = await mongoose.startSession();
    session.startTransaction();

    const id = req.params.id;
    // console.log("id", id);

    const deleteType: any = await Restaurant.findOneAndDelete({ _id: id });

    if (!deleteType) {
      throw new Error('Error while deleting Restaurant');
    }

    await session.commitTransaction();
    res.status(200).send({
      message: ' Restaurant deleted Successfully.',
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
