import mongoose from "mongoose";
import { CancelTask, PlaceOrder, TrackOrderStatus } from "../models";
import { Request, Response } from "express";
import { error } from "console";
import { getDirections } from "../helpers/common";

export async function placeOrder(req: Request, res: Response) {
    let session: any;
    try {
        session = await mongoose.startSession();
        session.startTransaction();
        const orderData = req.body;
        // const {order_details, pickup_details, drop_details, order_items} = req.body;
        // console.log("placeOrder Data: ==>", orderData)

        const saveOrder = await PlaceOrder.create({
            ...orderData,
            status: 'pending-accept',
            bookingTime: new Date()
        });

        if (!saveOrder) {
            throw new Error("error while placing oredr");
        }

        await session.commitTransaction();
        res.status(200).send({
            "status": true,
            "vendor_order_id": orderData.order_details.vendor_order_id,
            "message": "Order created",
            "Status_code": "ACCEPTED"
        });

        console.log('res sent');

    } catch (error: any) {
        console.log(error);

        res.status(400).send({ success: false, message: error.message });
        if (session) {
            await session.abortTransaction();
        }
    } finally {
        await session.endSession();
    }
}


export async function trackOrderStatus(req: Request, res: Response) {
    let session: any;
    try {
        session = await mongoose.startSession();
        session.startTransaction();
        const trackOrderStatus = req.body;
        console.log("trackOrderStatus Data: ==>", trackOrderStatus)
        // const {order_details, pickup_details, drop_details, order_items} = req.body;

        const trackOrder = await TrackOrderStatus.create(trackOrderStatus);


        if (!trackOrder) {
            throw new Error("error while tracking order");
        }

        await session.commitTransaction();
        res.status(200).send({
            message: ' Order tracked.',
        });


    } catch (error: any) {
        console.log(error);

        res.status(400).send({ success: false, message: error.message });
        if (session) {
            await session.abortTransaction();
        }
    } finally {
        await session.endSession();
    }
}


export async function cancelTask(req: Request, res: Response) {
    let session: any;
    try {
        session = await mongoose.startSession();
        session.startTransaction();
        const cancelTask = req.body;
        console.log("cancelTask Data: ==>", cancelTask)
        // const {order_details, pickup_details, drop_details, order_items} = req.body;

        const cancel_task = await CancelTask.create(cancelTask);


        if (!cancel_task) {
            throw new Error("error while canceling  order");
        }

        await session.commitTransaction();
        res.status(200).send({
            message: ' Order cancelled.',
        });

    } catch (error: any) {
        console.log(error);

        res.status(400).send({ success: false, message: error.message });
        if (session) {
            await session.abortTransaction();
        }
    } finally {
        await session.endSession();
    }
}

export async function getNewOrders(req: Request, res: Response) {
    let session: any;
    try {
        session = await mongoose.startSession();
        session.startTransaction();

        let startDate: any = new Date();
        let endDate: any = new Date();
        //! confirm if this below statement is changing hour in corner cases.
        endDate.setMinutes(endDate.getMinutes() - 10);

        const newOrder = await PlaceOrder.find({
            status: 'pending-accept',
            bookingTime: {
                $gte: endDate,
            },
        })

        await session.commitTransaction();

        res.status(200).send({
            message: 'new orders get successfully.',
            data: newOrder,
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

export async function orderAccept(req: Request, res: Response) {
    let session: any;
    try {
        session = await mongoose.startSession();
        session.startTransaction();

        const {driverLocation, pickUpDetails, id} = req.body;

        console.log(">>>>>>>>>>>>>>", driverLocation)
        //* Fetching Data of Driver using getDirections() Google API & storing in Rides-Collection.
        // const driverLocation = {
        //     latitude: 19.172141,
        //     longitude: 72.956832
        // };
        const pickUpLocation = {
            latitude: pickUpDetails.latitude,
            longitude: pickUpDetails.longitude,
        };

        

        const driverDataFromCurrLocationToPickup = await getDirections(
            driverLocation,
            pickUpLocation,
        );

        const newStatusUpdate = { status: 'pending-arival-restaurant', time: new Date() }

        const response = await PlaceOrder.findOneAndUpdate(
            { _id: id },
            { status: 'pending-arival-restaurant', statusUpdates: [newStatusUpdate] },
            { new: true },
        )


        await session.commitTransaction();

        res.status(200).send({
            message: ' orders accepted successfully.',
            data: { response, driverDataFromCurrLocationToPickup },
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


export async function orderUpdate(req: Request, res: Response) {
    let session: any;
    try {
        session = await mongoose.startSession();
        session.startTransaction();

        const{pickUpLocation, destination, orderId, status}= req.body;

        //* Fetching Data of Driver using getDirections() Google API & storing in Rides-Collection.
       

        const driverDataFromCurrLocationToPickup = await getDirections(
            pickUpLocation,
            destination
        );

        const newStatusUpdate = { status: status, time: new Date() }

        const response = await PlaceOrder.findOneAndUpdate(
            { _id: orderId },
            { status: status, statusUpdates: [newStatusUpdate] },
            { new: true },
        )

        // console.log(">>>>>>>>>>>>>>>>>", response, driverDataFromCurrLocationToPickup)

        await session.commitTransaction();

        res.status(200).send({
            message: ' orders updated successfully.',
            data: { response, driverDataFromCurrLocationToPickup },
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