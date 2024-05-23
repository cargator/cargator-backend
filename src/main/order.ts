import mongoose from "mongoose";
import { CancelTask, PlaceOrder, TrackOrderStatus } from "../models";
import { Request, Response } from "express";
import { error } from "console";

export async function placeOrder(req: Request, res: Response) {
    let session: any;
    try {
        session = await mongoose.startSession();
        session.startTransaction();
        const orderData = req.body;
        // const {order_details, pickup_details, drop_details, order_items} = req.body;
        console.log("placeOrder Data: ==>",orderData)

        const saveOrder = await PlaceOrder.create(orderData);

        // const newOrder:any = new PlaceOrder(orderData);

        // const saveOrder =await newOrder.save()
        // console.log("saveOrder--------", saveOrder)

        if(!saveOrder){
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


export async function trackOrderStatus(req: Request, res: Response){
    let session: any;
    try {
        session = await mongoose.startSession();
        session.startTransaction();
        const trackOrderStatus = req.body;
        console.log("trackOrderStatus Data: ==>",trackOrderStatus)
        // const {order_details, pickup_details, drop_details, order_items} = req.body;

        const trackOrder = await TrackOrderStatus.create(trackOrderStatus);


        if(!trackOrder){
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


export async function cancelTask(req: Request, res: Response){
    let session: any;
    try {
        session = await mongoose.startSession();
        session.startTransaction();
        const cancelTask = req.body;
        console.log("cancelTask Data: ==>",cancelTask)
        // const {order_details, pickup_details, drop_details, order_items} = req.body;

        const cancel_task = await CancelTask.create(cancelTask);


        if(!cancel_task){
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