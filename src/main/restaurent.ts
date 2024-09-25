
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
      throw new Error("Restaurant already exists");
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
      throw new Error("Error while creating Restaurant");
    }

    await session.commitTransaction();
    res.status(200).send({
      message: " restaurant data saved.",
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
        message: "Fetched all restaurants",
        data: restaurentList,
      });
    } catch (error: any) {
      console.log("get all restaurants error: ", error);
      // res.status(400).send({ error: error.message });
    }
  }


  export async function getAvailableRestaurent(req: Request, res: Response) {
    try {
      const restaurentList = await Restaurent.find();
      // console.log('vehicleData  allAvailableVehicles :>> ', vehicleData);
      if (!restaurentList) {
        throw new Error('restaurantList not found');
      }
      res.status(200).json({
        message: 'fetched Restaurant data successfully',
        data: restaurentList,
      });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }



  export async function deleteRestaurent(req: Request, res: Response) {
    let session: any;
    try {
      session = await mongoose.startSession();
      session.startTransaction();
  
      const id = req.params.id;
      // console.log("id", id);
  
      const deleteType:any = await Restaurent.findOneAndDelete({ _id: id });
  
      
  
      if (!deleteType) {
        throw new Error("Error while deleting Restaurant");
      }
  
      await session.commitTransaction();
      res.status(200).send({
        message: " Restaurant deleted Successfully.",
        data: deleteType,
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