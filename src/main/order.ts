import mongoose from "mongoose";
import { PlaceOrder } from "../models";
import { Request, Response } from "express";
import { error } from "console";

export async function placeOrder(req: Request, res: Response) {
    let session: any;
    try {
        session = await mongoose.startSession();
        session.startTransaction();
        const orderData = req.body;
        // const {order_details, pickup_details, drop_details, order_items} = req.body;
        console.log("----------------",orderData)

        const saveOrder = await PlaceOrder.create(orderData);

        // const newOrder:any = new PlaceOrder(orderData);

        // const saveOrder =await newOrder.save()

        if(!saveOrder){
            throw new Error("error while placing oredr");
        }

        await session.commitTransaction();
        res.status(200).send({
          message: ' Order Placed.',
        });


    } catch (error: any) {
        res.status(400).send({ success: false, message: error.message });
        if (session) {
            await session.abortTransaction();
        }
    } finally {
        await session.endSession();
    }
}


export async function trackOrderStatus(req: Request, res: Response){

}


export async function cancelTask(req: Request, res: Response){
    
}