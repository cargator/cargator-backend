import mongoose from "mongoose";
import { CancelTask, Driver, PlaceOrder, TrackOrderStatus } from "../models";
import { Request, Response } from "express";
import axios from 'axios';
import { error } from "console";
import { getDirections } from "../helpers/common";
import { OrderStatusEnum } from "../shared/enums/status.enum";
import environmentVars from "../constantsVars";
import { checkOrders } from "..";

const petpoojaAcknowledge = async (data: any) => {
    try {
        return axios.post(environmentVars.PETPUJA_API_URL, data);
    } catch (error: any) {
        throw new Error(error);
    }
}

export async function placeOrder(req: Request, res: Response) {
    try {
      const { order_details } = req.body;

      // const access_token = req.headers.access_token;

      // if (access_token != environmentVars.PETPOOJA_ACCESS_TOKEN) {
      //     throw new Error("Invalid Access Token!");
      // }

      console.log(JSON.stringify({ method: "placeOrder", message: "place Order body.", data: req.body }));

      const saveOrder = await PlaceOrder.create({
        ...req.body,
        status: OrderStatusEnum.ORDER_ACCEPTED,
      });

      if (!saveOrder) {
        throw new Error('error while placing order');
      }

      await checkOrders(saveOrder);
      res.status(200).send({
          status: true,
          vendor_order_id: order_details.vendor_order_id,
          message: 'Order created succcessfully.',
          Status_code: OrderStatusEnum.ORDER_ACCEPTED,
        });

        console.log(
          JSON.stringify({
            method: 'placeOrder',
            message: 'Order saved Response',
            data: saveOrder,
          }),
        );
    } catch (error: any) {
      console.log(
        JSON.stringify({
          method: 'placeOrder',
          message: error.message,
        }),
      );

      res.status(400).send({ success: false, message: error.message });
    }
}

export async function orderAccept(req: any, res: Response) {
    try {
      const driverId = req.decoded.user._id;
      const { driverLocation, pickUpDetails, id } = req.body;

      console.log(
        JSON.stringify({
          method: 'orderAccept',
          message: 'Order Accept Body',
          data: req.body,
        }),
      );

      const driverData = await Driver.findOne({ _id: driverId }).lean();

      if (!driverData) {
        console.log(
          JSON.stringify({
            method: 'orderAccept',
            message: 'Driver is not Found!',
            data: driverId,
          }),
        );

        res.status(404).send({
          status: true,
          driverId,
          message: 'Driver is not Found!',
        });
      }

      const pickUpLocation = {
        latitude: pickUpDetails.latitude, //latitude: 19.172141,
        longitude: pickUpDetails.longitude, //longitude: 72.956832
      };

      const driverDataFromCurrLocationToPickup = await getDirections(
        driverLocation,
        pickUpLocation,
      );

      const newStatusUpdate = {
        status: OrderStatusEnum.ORDER_ALLOTTED,
        time: new Date(),
      };

      const driverDetails = {
        driver_id: driverData?._id,
        name: driverData?.firstName,
        contact: driverData?.mobileNumber,
      };

      const response = await PlaceOrder.findOneAndUpdate(
        { _id: id },
        {
          status: OrderStatusEnum.ORDER_ALLOTTED,
          statusUpdates: newStatusUpdate,
          driver_details: driverDetails,
        },
      ).lean();

      if (response) {
        await Driver.findOneAndUpdate(
          { _id: driverId, rideStatus: 'online' },
          {
            rideStatus: 'on-ride',
          },
          { new: true },
        ).lean();
      }

      const obj = {
        status: true,
        data: {
          api_key: environmentVars.PETPUJA_API_KEY,
          api_secret_key: environmentVars.PETPUJA_SECRET_KEY,
          vendor_order_id: response?.order_details?.vendor_order_id,
          rider_name: response?.driver_details?.name,
          rider_contact: response?.driver_details?.contact,
        },
        message: 'Ok',
        status_code: OrderStatusEnum.ORDER_ALLOTTED,
      };

      await petpoojaAcknowledge(obj);

      console.log(
        JSON.stringify({
          method: 'orderAccept',
          message: 'order Accept Response',
          data: { response, driverDataFromCurrLocationToPickup },
        }),
      );
      res.status(200).send({
        message: 'Order accepted successfully.',
        data: { response, driverDataFromCurrLocationToPickup },
      });
    } catch (error: any) {
      console.log(
        JSON.stringify({
          method: 'orderAccept',
          message: error.message,
        }),
      );

      res.status(400).send({ success: false, message: error.message });
    }
}

export async function orderUpdate(req: any, res: Response) {
    try {
      const { pickUpLocation, destination, orderId } = req.body;
      const driverId = req.decoded.user._id;
      let status = req.body.status;

      console.log(
        JSON.stringify({
          method: 'orderUpdate',
          message: 'order Update body',
          data: req.body,
        }),
      );

      const driverData = await Driver.findOne({ _id: driverId }).lean();
      if (!driverData) {
        console.log(
          JSON.stringify({
            method: 'orderUpdate',
            message: 'Driver is not Found!',
            data: {
                driverId
            },
          }),
        );
        res.status(404).send({
          status: true,
          driverId,
          message: 'Driver is not Found!',
        });
      }

      if (!Object.values(OrderStatusEnum).includes(status)) {
        return res.status(400).send({ error: 'Invalid order status' });
      }

      status = status as OrderStatusEnum;
      const driverDataFromCurrLocationToPickup = await getDirections(
        pickUpLocation,
        destination,
      );

      const newStatusUpdate = { status: status, time: new Date() };
      const response = await PlaceOrder.findOneAndUpdate(
        { _id: orderId },
        { status: status, statusUpdates: [newStatusUpdate] },
        { new: true },
      );

      const obj = {
        status: true,
        data: {
          api_key: environmentVars.PETPUJA_API_KEY,
          api_secret_key: environmentVars.PETPUJA_SECRET_KEY,
          vendor_order_id: response?.order_details?.vendor_order_id,
          rider_name: response?.driver_details?.name,
          rider_contact: response?.driver_details?.contact,
        },
        message: 'Ok',
        status_code: response?.status,
      };

      await petpoojaAcknowledge(obj);

      if (
        status == OrderStatusEnum.DELIVERED &&
        response &&
        driverData?.rideStatus == 'on-ride'
      ) {
        await Driver.findOneAndUpdate(
          { _id: driverId },
          { rideStatus: 'online' },
        );
      }

      console.log(
        JSON.stringify({
          method: 'orderUpdate',
          message: 'order Update response',
          data: {
            status: response?.status,
            vendor_order_id: response?.order_details?.vendor_order_id,
          },
        }),
      );

      res.status(200).send({
        message: ' orders updated successfully.',
        data: { response, driverDataFromCurrLocationToPickup },
      });
      
    } catch (error: any) {
      console.log(
        JSON.stringify({
          method: 'orderUpdate',
          message: error.message,
        }),
      );

      res.status(400).send({ success: false, message: error.message });
    }
}

export async function trackOrderStatus(req: Request, res: Response) {
    try {
      const { vendor_order_id } = req.body;
      // const access_token = req.headers.access_token;

      // if (access_token != environmentVars.PETPOOJA_ACCESS_TOKEN) {
      //     throw new Error("Invalid Access Token!");
      // }
      console.log(
        JSON.stringify({
          method: 'trackOrderStatus',
          message: 'track order body',
          data: { vendor_order_id },
        }),
      );

      const checkOrder = await PlaceOrder.findOne({
        'order_details.vendor_order_id': vendor_order_id,
      }).lean();

      if (!checkOrder) {
        console.log(
          JSON.stringify({
            method: 'trackOrderStatus',
            message: 'Order is not Found!',
            data: {
                vendor_order_id
            },
          }),
        );

        res.status(404).send({
          status: true,
          vendor_order_id,
          message: 'Order is not Found!',
        });
      }

      res.send({
        status: true,
        message: 'Ok',
        status_code: checkOrder?.status,
        data: {
          vendor_order_id: vendor_order_id,
          rider_name: checkOrder?.driver_details?.name,
          rider_contact: checkOrder?.driver_details?.contact,
        },
      });

      console.log(
        JSON.stringify({
          method: 'trackOrderStatus',
          message: 'track order status response',
          data: {
            vendor_order_id: vendor_order_id,
            rider_name: checkOrder?.driver_details?.name,
            rider_contact: checkOrder?.driver_details?.contact,
          },
        }),
      );

    } catch (error: any) {
      console.log(
        JSON.stringify({
          method: 'trackOrderStatus',
          message: error.message,
        }),
      );

      res.status(400).send({ success: false, message: error.message });
    }
}

export async function cancelTask(req: Request, res: Response) {
    try {
      const { vendor_order_id } = req.body;
      // const access_token = req.headers.access_token;

      // if (access_token != environmentVars.PETPOOJA_ACCESS_TOKEN) {
      //     throw new Error("Invalid Access Token!");
      // }
      console.log(
        JSON.stringify({
          method: 'cancelTask',
          message: 'cancel order body',
          data: { vendor_order_id },
        }),
      );

      const newStatusUpdate = {
        status: OrderStatusEnum.ORDER_CANCELLED,
        time: new Date(),
      };

      const cancel_task = await PlaceOrder.findOneAndUpdate(
        {
          'order_details.vendor_order_id': vendor_order_id,
        },
        {
          status: OrderStatusEnum.ORDER_CANCELLED,
          statusUpdates: [newStatusUpdate],
        },
      ).lean();

      if (cancel_task?.driver_details) {
        await Driver.findOneAndUpdate(
          {
            _id: cancel_task?.driver_details?.driver_id,
            rideStatus: 'on-ride',
          },
          { rideStatus: 'online' },
        );
      }

      if (!cancel_task) {
        throw new Error('error while canceling  order');
      }

      const obj = {
        status: true,
        data: {
          api_key: environmentVars.PETPUJA_API_KEY,
          api_secret_key: environmentVars.PETPUJA_SECRET_KEY,
          vendor_order_id: cancel_task?.order_details?.vendor_order_id,
          rider_name: cancel_task?.driver_details?.name,
          rider_contact: cancel_task?.driver_details?.contact,
        },
        message: 'Ok',
        status_code: OrderStatusEnum.ORDER_CANCELLED,
      };

      await petpoojaAcknowledge(obj);

      console.log(
        JSON.stringify({
          method: 'cancelTask',
          message: 'cancel order response',
          data: cancel_task?.order_details,
        }),
      );

      res.status(200).send({
        status: true,
        status_code: OrderStatusEnum.ORDER_CANCELLED,
        message: 'Order has been canceled',
      });
    } catch (error: any) {
      console.log(
        JSON.stringify({
          method: 'cancelTask',
          message: error.message,
        }),
      );

      res.status(400).send({ success: false, message: error.message });
    }
}