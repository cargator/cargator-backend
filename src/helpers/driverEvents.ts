import { Types } from 'mongoose';
import { Server, Socket } from 'socket.io';
import { pubClient } from '..';
import { Driver } from '../models/driver.model';
import { PlaceOrder } from '../models/placeOrder.model';
import { OrderStatusEnum } from '../shared/enums/status.enum';
import { formatSocketResponse, getDirections } from './common';
import constants from '../constantsVars';
import axios from 'axios';
// const { utilsData } = require('../index.ts');

const driversSocket: Record<string, Socket> = {};

// Function to get the socket of a driver based on their userId
const getDriverSocket = (userId: string): Socket => {
  return driversSocket[userId];
};

const getAllSocket = () => {
  return { ...driversSocket };
};

// Function to set the socket of a driver based on their userId
const setDriverSocket = (userId: string, socket: Socket): Socket => {
  driversSocket[userId] = socket;
  return socket;
};

// Function to handle the event when a driver's socket is connected
const driverSocketConnected = async (
  socket: Socket,
  userId: string,
  io: Server,
  restaurentName:string,
) => {
  let _userId = new Types.ObjectId(userId);
  try {
    // Set the driver's socket in the driversSocket object
    driversSocket[userId] = socket;
    console.log('Socket connected successfully!', userId, restaurentName);
  } catch (err: any) {
    socket.emit(
      'error',
      formatSocketResponse({
        message: err.message,
      }),
    );
  }

  const petpoojaAcknowledge = async (data: any) => {
    try {
      console.log('petpoojaAcknowledge sent on accept order', data);
      return axios.post(constants.PETPUJA_API_URL, data);
    } catch (error: any) {
      console.log('petpoojaAcknowledge error while accepting', error);
      throw new Error(error);
    }
  };

  // accept-order event---------
  socket.on('accept-order', async (body: any) => {
    let session: any;
    // todo: take driverId from token/ socket
    try {
      if (!body.id) {
        // If order ID is missing in the request, handle the error
        throw new Error('OrderId is not found.');
      }

      session = await PlaceOrder.startSession();
      session.startTransaction();

      const driver_location = body.driverLoc;

      // check if order is available for this driver
      const driverData: any = await Driver.findOne({ _id: _userId }).lean();
      if (!driverData) {
        pubClient.publish(
          'order-update-response',
          formatSocketResponse({
            type: 'order-update-response',
            message: {
              type: 'accept-order-response',
              message: {
                message: `Driver is not Found!`,
                driverId: userId,
                status: 404,
              },
            },
          }),
        );
        return;
      }

      if (driverData.rideStatus === 'on-ride') {
        pubClient.publish(
          'order-update-response',
          formatSocketResponse({
            type: 'order-update-response',
            message: {
              type: 'accept-order-response',
              message: {
                message: `Already on a ongoing order`,
                driverId: userId,
                status: 404,
              },
            },
          }),
        );
        return;
      }

      const driverDetails = {
        driver_id: driverData?._id,
        name: driverData?.firstName,
        contact: driverData?.mobileNumber,
      };

      const newStatusUpdate = {
        status: OrderStatusEnum.ORDER_ALLOTTED,
        location: [driver_location.latitude, driver_location.longitude],
        time: new Date(),
      };

      let updatedOrder: any = await PlaceOrder.findOneAndUpdate(
        {
          _id: new Types.ObjectId(body.id),
          status: OrderStatusEnum.ORDER_ACCEPTED,
        },
        {
          status: OrderStatusEnum.ORDER_ALLOTTED,
          $push: { statusUpdates: newStatusUpdate },
          driver_details: driverDetails,
        },
        { session, new: true },
      ).lean();

      if (updatedOrder == null) {
        pubClient.publish(
          'order-update-response',
          formatSocketResponse({
            type: 'order-update-response',
            message: {
              type: 'accept-order-response',
              message: {
                message: `Order Already Assigned To Someone!`,
                order: { _id: body.id, status: 'ALLOTTED' },
              },
            },
          }),
        );
        return;
      }

      // Update the driver's order status to 'ongoing-order'
      const updateDriver = await Driver.findOneAndUpdate(
        { _id: _userId, rideStatus: 'online' },
        {
          rideStatus: 'on-ride',
        },
        { session, new: true },
      ).lean();

      if (!updateDriver) {
        pubClient.publish(
          'order-update-response',
          formatSocketResponse({
            message: {
              message: {
                message: `Order Not Accepted!`,
                driverId: userId,
                status: 404,
              },
            },
          }),
        );
        return;
      }
      //* Fetching Data of Driver using getDirections() Google API & storing in Rides-Collection.
      const driverLocation = {
        latitude: driver_location.latitude,
        longitude: driver_location.longitude,
      };
      const pickupLocation = {
        latitude: updatedOrder.pickup_details.latitude,
        longitude: updatedOrder.pickup_details.longitude,
      };

      const driverDataFromCurrLocationToPickup = await getDirections(
        driverLocation,
        pickupLocation,
      );

      updatedOrder = await PlaceOrder.findOneAndUpdate(
        {
          _id: new Types.ObjectId(body.id),
          status: OrderStatusEnum.ORDER_ALLOTTED,
        },
        {
          riderPathToPickUp: driverDataFromCurrLocationToPickup?.coords,
        },
        { session, new: true },
      ).lean();

      const obj = {
        status: true,
        data: {
          api_key: constants.PETPUJA_API_KEY,
          api_secret_key: constants.PETPUJA_SECRET_KEY,
          vendor_order_id: updatedOrder?.order_details?.vendor_order_id,
          rider_name: updatedOrder?.driver_details?.name,
          rider_contact: updatedOrder?.driver_details?.contact,
        },
        message: 'Ok',
        status_code: updatedOrder?.status,
      };

      console.log('order accepted successfully');
      const acknowledgementResponse = await petpoojaAcknowledge(obj);
      console.log(
        'Order accept acknowledgement response',
        acknowledgementResponse.data,
      );

      // console.log(
      //   JSON.stringify({
      //     method: 'acknoeledgementResponse',
      //     message: 'Order accept acknowledgement response',
      //     data:
      //       acknowledgementResponse.data
      //     ,
      //   }),
      // );

      pubClient.publish(
        'order-update-response',
        formatSocketResponse({
          type: 'order-update-response',
          message: {
            type: 'accept-order-response',
            message: {
              message: `Order Accepted!`,
              driverId: userId,
              order: updatedOrder,
              path: driverDataFromCurrLocationToPickup,
            },
          },
        }),
      );
      console.log('order published to socket to all drivers');

      await session.commitTransaction();
    } catch (err: any) {
      console.log('err :>> ', err);
      //! add proper error message. Or you can add status codes for every error message and handle frontend based on this errorcodes create enum for this.
      socket.emit(
        'error',
        formatSocketResponse({
          event: 'order-accept',
          message: err.message,
        }),
      );
      if (session) {
        await session.abortTransaction();
      }
    }
  });

  socket.on('disconnect', async () => {
    console.log(`Driver ${userId} disconnected !`);

    // Remove the driver's socket from the driversSocket object
    delete driversSocket[userId];

    // Leave all rooms associated with the current socket
    socket.rooms.forEach((room) => {
      socket.leave(room);
    });
  });
};
// Exporting functions and the event listener for reuse
export default driverSocketConnected;
export { getAllSocket, getDriverSocket, setDriverSocket };
