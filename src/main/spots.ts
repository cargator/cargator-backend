import { Spots, Vehicles } from "../models";
import { Request, Response } from "express";
import mongoose from "mongoose";

export async function createSpot(req: Request, res: Response) {
//   console.log("body", req.body);
  let session: any;
  try {
    session = await mongoose.startSession();
    const { spotName, vehicleNumber, bounds } = req.body;
    // console.log('object1 :>> ');
    session.startTransaction();

    const checkStatus = await Spots.findOne(
      {
        vehicleNumber: vehicleNumber.toUpperCase(),
        // vehicleStatus: "unavailable",
      },
      null,
      { session: session }
    );

    if (checkStatus) {
      throw new Error("Vehicle might be assigned to someone");
    }

    const existingSpot = await Spots.findOne({ bounds: [bounds] }, null, {
      session: session,
    });
    if (existingSpot) {
      throw new Error("Location Already used");
    }

    const random = Math.floor(Math.random() * 9000 + 1000);

    // console.log(random);

    // console.log('object 2:>> ', existingDriver);

    const spots = await Spots.create(
      [
        {
          spotId: random,
          spotName,
          vehicleNumber: vehicleNumber.toUpperCase(),
          bounds,
        },
      ],
      { session: session }
    );

    // const vehiclespotName = await ZenzoVehicles.findOneAndUpdate(
    //   { vehicleNumber },
    //   { spotName: spotName },
    //   { new: true }
    // );

    // console.log("spot data :>> ", spots);
    // throw new Error('Error while creating driver');

    if (spots.length == 0) {
      throw new Error("Error while creating spot");
    }

    //   const vehicle = await Vehicles.findOneAndUpdate(
    //     {
    //       vehicleNumber: vehicleNumber.toUpperCase(),
    //       vehicleStatus: 'available',
    //     },
    //     { vehicleStatus: 'unavailable', vehicleAssignedToId: spots[0]._id },
    //     { session: session },
    //   );

    // console.log('object vehicle :>> ', vehicle);

    //   if (!vehicle) {
    //     throw new Error('Error while updating vehicle');
    //   }getActiveSpot

    await session.commitTransaction();
    res.status(200).send({
      message: " Spot data saved.",
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

export async function getSpotList(req: Request, res: Response) {
  try {
    const page: any = req?.query?.page;
    const limit: any = req.query.limit;
    // console.log("page",page)
    // console.log("limit",limit)
    const dataLimit = parseInt(limit);
    const skip = (page - 1) * limit;
    const spotList = await Spots.aggregate([
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
      data: spotList,
    });
  } catch (error: any) {
    console.log("get all spot error: ", error);
    // res.status(400).send({ error: error.message });
  }
}

export async function getSpotListVehicle(req: Request, res: Response) {
  try {
    const spotList = await Spots.find();
    // console.log(spotList)
    return res.status(200).json({
      message: "Fetched all spots",
      data: spotList,
    });
  } catch (error: any) {
    console.log("get all spot error: ", error);
    // res.status(400).send({ error: error.message });
  }
}

export async function deleteSpot(req: Request, res: Response) {
  let session: any;
  try {
    session = await mongoose.startSession();
    session.startTransaction();

    const id = req.params.id;
    // console.log("id", id);

    const deleteType:any = await Spots.findOneAndDelete({ _id: id });

    const vehicleNumber = deleteType?.vehicleNumber ;

    // const updateVehicleSpotName = await ZenzoVehicles.findOneAndUpdate(
    //   {vehicleNumber},
    //   {spotName:''},
    //   {new:true}
    //   )

    if (!deleteType) {
      throw new Error("Error while deleting spot");
    }

    await session.commitTransaction();
    res.status(200).send({
      message: " spot deleted Successfully.",
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

export async function getActiveSpot(req: Request, res: Response) {
  try {
    // Fetch bounds data from MongoDB with aggregation
    const boundsData = await Spots.aggregate([
        {
            $project: {
                _id: 0,
                bounds: 1
            }
        }
    ]);

    // console.log("boundsData:",boundsData)

    // Extract bounds from the result and create an array
    const boundsArray = boundsData.map(item => item.bounds);
    // console.log("boundsData----:",boundsArray)
    res.json(boundsArray);
} catch (error) {
    console.error('Error fetching bounds data:', error);
    res.status(500).json({ message: 'Internal server error' });
}
}