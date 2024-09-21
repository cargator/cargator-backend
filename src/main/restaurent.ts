
import { Request, Response } from "express";
import mongoose from "mongoose";
import { Restaurent } from "../models/reataurent.model";

export async function createRestaurent(req: Request, res: Response) {
  let session: any;
  try {
    session = await mongoose.startSession();
    const { restaurentName,bounds } = req.body;

    const restaurentNameToLowerCase = restaurentName.toLowerCase().trim();

    session.startTransaction();

    const checkStatus: any = await Restaurent.findOne(
      {
        restaurentName: req.body.restaurentName,
        restaurentNameToLowerCase: restaurentNameToLowerCase,
      },
      null,
      { session: session }
    );

    if (checkStatus) {
      throw new Error("Restaurent already exists");
    }


    const restaurent: any = await Restaurent.create(
      [
        {
          restaurentName,
          restaurentNameToLowerCase: restaurentNameToLowerCase,
          bounds,
        },
      ],
      { session: session }
    );


    if (restaurent.length == 0) {
      throw new Error("Error while creating Restaurent");
    }

    await session.commitTransaction();
    res.status(200).send({
      message: " restaurent data saved.",
    });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
    if (session) {
      await session.abortTransaction();
    }
    console.log("err :>> ", error);
  } finally {
    if (session) {
      await session.endSession();
    }
  }
}

export async function getRestaurentList(req: Request, res: Response) {
    try {
      const page: any = req?.query?.page;
      const limit: any = req.query.limit;
      // console.log("page",page)
      // console.log("limit",limit)
      const dataLimit = parseInt(limit);
      const skip = (page - 1) * limit;
      const restaurentList = await Restaurent.aggregate([
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
            count: [{ $count: "totalcount" }],
          },
        },
      ]);
      // console.log(spotList)
      return res.status(200).json({
        message: "Fetched all spots",
        data: restaurentList,
      });
    } catch (error: any) {
      console.log("get all spot error: ", error);
      // res.status(400).send({ error: error.message });
    }
  }


  export async function getAvailableRestaurent(req: Request, res: Response) {
    try {
      const restaurentList = await Restaurent.find();
      // console.log('vehicleData  allAvailableVehicles :>> ', vehicleData);
      if (!restaurentList) {
        throw new Error('restaurentList not found');
      }
      res.status(200).json({
        message: 'fetched restaurent data successfully',
        data: restaurentList,
      });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }