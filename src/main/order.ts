import mongoose from "mongoose";
import { CancelTask, Driver, PlaceOrder, TrackOrderStatus } from "../models";
import { Request, Response } from "express";
import { error } from "console";
import { getDirections } from "../helpers/common";
import { OrderStatusEnum } from "../shared/enums/status.enum";
import environmentVars from "../constantsVars";


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

export async function placeOrder(req: Request, res: Response) {
    try {
        const { order_details } = req.body;

        const access_token = req.headers.access_token;

        if(access_token != environmentVars.PETPOOJA_ACCESS_TOKEN) {
            throw new Error("Invalid Access Token!");
        }

        console.log(JSON.stringify({ method: "placeOrder", message: "fetch body from Request.", data: req.body }));

        const saveOrder = await PlaceOrder.create({
            ...req.body,
            status: OrderStatusEnum.ORDER_ACCEPTED,
        });

        if (!saveOrder) {
            throw new Error("error while placing order");
        }

        console.log(JSON.stringify({ method: "placeOrder", message: "Order saved Response", data: saveOrder }));

        res.status(200).send({
            status: true,
            vendor_order_id: order_details.vendor_order_id,
            message: "Order created succcessfully.",
            Status_code: OrderStatusEnum.ORDER_ACCEPTED
        });

    } catch (error: any) {
        console.log(
            JSON.stringify({
                method: "placeOrder",
                message: error.message
            })
        )

        res.status(400)
            .send({ success: false, message: error.message });
    }
}

export async function orderAccept(req: any, res: Response) {
    try {
        const driverId = req.decoded.user._id;
        const { driverLocation, pickUpDetails, id } = req.body;

        const driverData = await Driver.findOne({ _id: driverId }).lean();
        
        if (!driverData) {
            console.log("unauth");
        }

        const pickUpLocation = {
            latitude: pickUpDetails.latitude,//latitude: 19.172141,
            longitude: pickUpDetails.longitude,//longitude: 72.956832
        };

        const driverDataFromCurrLocationToPickup = await getDirections(
            driverLocation,
            pickUpLocation,
        );

        const newStatusUpdate = { status: OrderStatusEnum.ORDER_ALLOTTED, time: new Date() };
        const driverDetails = {
            driver_id: driverData?._id,
            name: driverData?.firstName,
            contact: driverData?.mobileNumber
        }


        const response = await PlaceOrder.findOneAndUpdate(
            { _id: id },
            {
                status: OrderStatusEnum.ORDER_ALLOTTED,
                statusUpdates: [newStatusUpdate],
                driver_details: driverDetails
            },
            { new: true },
        ).lean()

        if (response) {
            await Driver.findOneAndUpdate(
                { _id: driverId, rideStatus: 'online' },
                {
                    rideStatus: 'on-ride',
                },
                { new: true },
            ).lean();
        }

        res.status(200).send({
            message: 'Order accepted successfully.',
            data: { response, driverDataFromCurrLocationToPickup },
        });

    } catch (error: any) {
        console.log(
            JSON.stringify({
                method: "orderAccept",
                message: error.message
            })
        )

        res.status(400)
            .send({ success: false, message: error.message });
    }
}

export async function orderUpdate(req: Request, res: Response) {
    try {
        const { pickUpLocation, destination, orderId } = req.body;
        let status = req.body.status;

        if (!Object.values(OrderStatusEnum).includes(status)) {
            return res.status(400).send({ error: 'Invalid order status' });
        }
    
        status = status as OrderStatusEnum;

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
          



        res.status(200).send({
            message: ' orders updated successfully.',
            data: { response, driverDataFromCurrLocationToPickup },
        });
    } catch (error: any) {
        console.log(
            JSON.stringify({
                method: "orderUpdate",
                message: error.message
            })
        )

        res.status(400)
            .send({ success: false, message: error.message });
    }
}

export async function trackOrderStatus (req: Request, res: Response) {
    try {
        const { vendor_order_id } = req.body;
        const access_token = req.headers.access_token;

        if(access_token != environmentVars.PETPOOJA_ACCESS_TOKEN) {
            throw new Error("Invalid Access Token!");
        }
        const checkOrder = await PlaceOrder.findOne({ 'order_details.vendor_order_id': vendor_order_id }).lean()
        if( !checkOrder ) {
            res.status(404).send({
                status: true,
                vendor_order_id,
                message: "Order is not Found!"
            })
        }

        res.send({
            status: true, 
            message: "Ok",
            status_code: checkOrder?.status,
            data: {
                vendor_order_id: vendor_order_id,
                rider_name: checkOrder?.driver_details?.name,
                rider_contact: checkOrder?.driver_details?.contact
            },
        })

    } catch (error: any) {
        console.log(
            JSON.stringify({
                method: "trackOrderStatus",
                message: error.message
            })
        )

        res.status(400)
            .send({ success: false, message: error.message });
    }
}

export async function cancelTask(req: Request, res: Response) {
    try {
        const { vendor_order_id } = req.body;
        const access_token = req.headers.access_token;

        if (access_token != environmentVars.PETPOOJA_ACCESS_TOKEN) {
            throw new Error("Invalid Access Token!");
        }

        const newStatusUpdate = { status: OrderStatusEnum.ORDER_CANCELLED, time: new Date() }
        const cancel_task = await PlaceOrder.findOneAndUpdate(
            {
                'order_details.vendor_order_id': vendor_order_id
            },
            {
                status: OrderStatusEnum.ORDER_CANCELLED, statusUpdates: [newStatusUpdate]
            }
        ).lean();

        if (cancel_task?.driver_details) {
            await Driver.findOneAndUpdate(
                { _id: cancel_task?.driver_details?.driver_id },
                { rideStatus: 'online' }
            )
        }

        console.log(cancel_task);

        if (!cancel_task) {
            throw new Error("error while canceling  order");
        }

        res.status(200).send({
            "status": true,// true/false 
            "status_code": OrderStatusEnum.ORDER_CANCELLED,
            "message": "Order has been canceled",
        });

    } catch (error: any) {
        console.log(
            JSON.stringify({
                method: "cancelTask",
                message: error.message
            })
        )

        res.status(400)
            .send({ success: false, message: error.message });
    }
}


