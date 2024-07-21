import { Types } from 'mongoose';
import { Server, Socket } from 'socket.io';
import { Orders, PlaceOrder } from '../models';
import { formatSocketResponse, getDirections } from './common';
import { OrderStatusEnum } from '../shared/enums/status.enum';
import { Driver } from '../models/driver.model';
import { pubClient } from '..';
import { ObjectId, ObjectIdLike } from 'bson';

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
) => {
  let _userId = new Types.ObjectId(userId);
  try {
    const driverInfo = await Driver.findOne(
      {
        _id: _userId,
        status: 'active',
      },
      { rideStatus: 1 },
    ).lean();

    if (!driverInfo) {
      throw new Error('Driver not valid or inactive');
    }
    // Set the driver's socket in the driversSocket object
    driversSocket[userId] = socket;

    socket.emit(
      'driver-online',
      formatSocketResponse({
        event: 'driver-online',
        message: 'Driver connected',
      }),
    );

    const updatedDriver = await Driver.findOneAndUpdate(
      { _id: _userId, rideStatus: { $ne: 'on-ride' } },
      { rideStatus: 'online' },
      { new: true },
    );
  } catch (err: any) {
    socket.emit(
      'error',
      formatSocketResponse({
        message: err.message,
      }),
    );
  }

  // Event listener for when a payment is completed
  // ask
  socket.on('payment-completed', async (body: { rideId: string | number | ObjectId | Uint8Array | ObjectIdLike | undefined; }) => {
    console.log('---- payment-completed ----');

    let session;

    try {
      session = await Orders.startSession();
      // Update the ride status to 'completed' upon successful payment completion
      session.startTransaction();
      let updatedRide: any = await Orders.findOneAndUpdate(
        {
          _id: new Types.ObjectId(body.rideId),
          status: 'pending-payment',
          paymentMode: 'Cash',
        },
        {
          status: 'completed',
        },
        { session: session, new: true },
      ).lean();

      if (!updatedRide) {
        //! throw error on socket.
        throw new Error('Document not found while completing payment.');
      }

      // Emit a ride-status event to the ride room to indicate completed payment and ride
      io.to(`${updatedRide._id.toString()}-ride-room`).emit(
        'ride-status',
        formatSocketResponse({
          message: `payment-completed`,
          data: updatedRide,
          status: 200,
        }),
      );

      // Update the driver's ride status to 'online' after ride completion & increment 'totalRidesCompleted' count.
      const updateDriver = await Driver.updateOne(
        { _id: updatedRide.driverId, rideStatus: 'on-ride' },
        {
          rideStatus: 'online',
        },
        { session: session, new: true },
      ).lean();

      if (!updateDriver) {
        throw new Error('Driver not found while payment-completion.');
      }

      // Increment the riders's 'totalRidesCompleted' count.
      const updateRider = await Orders.findByIdAndUpdate(
        updatedRide.riderId,
        {
          $inc: { totalRidesCompleted: 1 },
        },
        { new: true },
      ).lean();

      if (!updateRider) {
        throw new Error('Rider not found while payment-completion.');
      }

      // Empty the Socket Room by making all members leave
      await io
        .in(`${updatedRide._id.toString()}-ride-room`)
        .fetchSockets()
        .then((allRoomMembers: any[]) => {
          allRoomMembers.forEach((member: { leave: (arg0: string) => void; }) => {
            member.leave(`${updatedRide._id.toString()}-ride-room`);
          });
        })
        .catch((error: any) => {
          // Handle errors here
          console.log(error);
        });

      await session.commitTransaction();
    } catch (err: any) {
      console.log('err in payment-completed', err);
      socket.emit(
        'error',
        formatSocketResponse({
          event: 'payment-completed',
          message: err.message,
        }),
      );
      if (session) {
        await session.abortTransaction();
      }
    } finally {
      if (session) {
        await session.endSession();
      }
    }
  });

  /////////////// PetPooja Socket Implementation ////////////////////////////////////////////
  // accept-order event---------
  socket.on('accept-order', async (body: any) => {
    let session: any;
    // todo: take driverId from token/ socket
    try {
      session = await PlaceOrder.startSession();
      session.startTransaction();

      const driver_location = body.driverLoc;

      if (!body.id) {
        throw new Error('OrderId is not found.');
      }
      // check if order is available for this driver
      const checkDriver: any = await Driver.findOne(
        { _id: _userId, rideStatus: 'on-ride' },
        { new: true },
      ).lean();

      if (checkDriver) {
        pubClient.publish(
          'order-update-response',
          formatSocketResponse({
            type: 'order-update-response',
            message: {
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

      const driverData = await Driver.findOne({ _id: _userId }).lean();

      if (!driverData) {
        pubClient.publish(
          'order-update-response',
          formatSocketResponse({
            type: 'order-update-response',
            message: {
              message: {
                message: `Driver is not Found!`,
                driverId: userId,
                status: 404,
              },
            },
          }),
        );
        console.log(
          JSON.stringify({
            method: 'orderAccept',
            message: 'Driver is not Found!',
            data: _userId,
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
                message: `Order Not Found!`,
                order: { orderId: body.id },
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
                message: `Order rejected!`,
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
      //! add proper error message. Or you can add status codes for every error message and handle frontend based on this errorcodes create enum for this.
      socket.emit(
        'error',
        formatSocketResponse({
          event: 'ride-accept',
          message: err.message,
        }),
      );
      if (session) {
        await session.abortTransaction();
      }
    }
  });

  socket.on('payment-status', async (body: any) => {
    // console.log("payment-status");
    console.log('Paymont done');
    const order = await PlaceOrder.findByIdAndUpdate(
      body._id,
      { 'order_details.payment_status': true },
      { new: true }, // This option returns the modified document
    );
    // console.log(order);
  });

  // update order --------
  socket.on('update-order-status', async (body: any) => {
    let session: any;
    let driverDataFromPickupToDrop;
    try {
      const { id, status } = body;

      session = await PlaceOrder.startSession();
      session.startTransaction();

      if (!body.id) {
        throw new Error('OrderId is not found.');
      }

      if (!Object.values(OrderStatusEnum).includes(status)) {
        throw new Error('Invalid order status');
      }

      const checkCancelledOrder: any = await PlaceOrder.findById(
        new Types.ObjectId(body.id),
      );

      // console.log("checkCancelledOrder>>>>",checkCancelledOrder);

      if (checkCancelledOrder.status === OrderStatusEnum.ORDER_CANCELLED) {
        await Driver.findOneAndUpdate(
          { _id: _userId, rideStatus: 'on-ride' },
          {
            rideStatus: 'online',
          },
          { session, new: true },
        ).lean();

        pubClient.publish(
          'order-update-response',
          formatSocketResponse({
            type: 'order-update-response',
            message: {
              message: {
                message: 'order cancelled by customer',
                status: 405,
                driverId: userId,
              },
            },
          }),
        );
        await session.commitTransaction();
        return;
      }

      const newStatusUpdate = {
        status: status,
        time: new Date(),
      };

      let updateOrder: any = await PlaceOrder.findOneAndUpdate(
        {
          _id: new Types.ObjectId(body.id),
        },
        {
          status: status,
          $push: { statusUpdates: newStatusUpdate },
        },
        { session, new: true },
      ).lean();

      if (updateOrder == null) {
        // If the order is not available for acceptance, emit an error response
        pubClient.publish(
          'order-update-response',
          formatSocketResponse({
            type: 'order-update-response',
            message: {
              message: {
                message: 'order not found',
                status: 404,
                driverId: userId,
                order: updateOrder,
              },
            },
          }),
        );
        return;
      }

      if (status === OrderStatusEnum.DELIVERED) {
        // Update the driver's order status to 'online'

        let updateDriver = await Driver.findOneAndUpdate(
          { _id: _userId, rideStatus: 'on-ride' },
          {
            rideStatus: 'online',
          },
          { session, new: true },
        ).lean();

        if (!updateDriver) {
          // If the driver update fails, emit a response indicating ride rejection
          pubClient.publish(
            'order-update-response',
            formatSocketResponse({
              type: 'order-update-response',
              message: {
                message: {
                  message: 'driver status not updated',
                  status: 404,
                  driverId: userId,
                },
              },
            }),
          );
          throw new Error('Order rejected');
        }
      }

      if (status === OrderStatusEnum.DISPATCHED) {
        const pickupLocation = {
          latitude: updateOrder.pickup_details.latitude,
          longitude: updateOrder.pickup_details.longitude,
        };
        const dropLocation = {
          latitude: updateOrder.drop_details.latitude,
          longitude: updateOrder.drop_details.longitude,
        };

        driverDataFromPickupToDrop = await getDirections(
          pickupLocation,
          dropLocation,
        );

        updateOrder = await PlaceOrder.findOneAndUpdate(
          {
            _id: new Types.ObjectId(body.id),
          },
          {
            pickupToDrop: driverDataFromPickupToDrop?.coords,
          },
          { session, new: true },
        ).lean();
      }

      pubClient.publish(
        'order-update-response',
        formatSocketResponse({
          type: 'order-update-response',
          message: {
            type: 'order-update-response',
            message: {
              message: `order updated`,
              driverId: userId,
              order: updateOrder,
              path: driverDataFromPickupToDrop,
            },
          },
        }),
      );

      await session.commitTransaction();
    } catch (err: any) {
      console.log('err in order-update', err);

      //! add proper error message. Or you can add status codes for every error message and handle frontend based on this errorcodes create enum for this.
      socket.emit(
        'error',
        formatSocketResponse({
          event: 'update-order',
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
    delete driversSocket[userId];

    // Leave all rooms associated with the current socket
    socket.rooms.forEach((room: any) => {
      socket.leave(room);
    });
  });
};
// Exporting functions and the event listener for reuse
export default driverSocketConnected;
export { getAllSocket, getDriverSocket, setDriverSocket };
