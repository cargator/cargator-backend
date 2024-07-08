import { Types } from 'mongoose';
import { Server, Socket } from 'socket.io';
import { PlaceOrder } from '../models';
import { formatSocketResponse, getDirections } from './common';
import { OrderStatusEnum } from '../shared/enums/status.enum';
import { Driver } from '../models/driver.model';

const driversSocket: Record<string, Socket> = {};

// Function to get the socket of a driver based on their userId
const getDriverSocket = (userId: string): Socket => {
  return driversSocket[userId];
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
  } catch (err: any) {
    socket.emit(
      'error',
      formatSocketResponse({
        message: err.message,
      }),
    );
  }

  /////////////// PetPooja Socket Implementation ////////////////////////////////////////////
  // accept-order event---------
  socket.on('accept-order', async (body: any) => {
    let session: any;
    // todo: take driverId from token/ socket
    try {
      session = await PlaceOrder.startSession();
      session.startTransaction();

      const driver_location = body.driverLoc;
      console.log("accept order request", body);
      if (!body.id) {
        throw new Error('OrderId is not found.');
      }
      // check if order is available for this driver
      const checkDriver: any = await Driver.findOne(
        { _id: _userId, rideStatus: 'on-ride' },
        { new: true },
      ).lean();
      if (checkDriver) {
        return;
      }

      const driverData = await Driver.findOne({ _id: _userId }).lean();

      if (!driverData) {
        console.log(
          JSON.stringify({
            method: 'orderAccept',
            message: 'Driver is not Found!',
            data: _userId,
          }),
        );
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
          statusUpdates: newStatusUpdate,
          driver_details: driverDetails,
        },
        { session, new: true },
      ).lean();

      if (updatedOrder == null) {
        // If the order is not available for acceptance, emit an error response
        socket.emit(
          'ride-accept-response',
          formatSocketResponse({
            message: 'order not available',
            status: 404,
            driverId: userId,
            order: updatedOrder,
          }),
        );

        throw new Error('order-accept event error: Order not found!');
      }

      // Update the driver's order status to 'ongoing-order'
      const updateDriver = await Driver.findOneAndUpdate(
        { _id: _userId, rideStatus: 'online' },
        {
          rideStatus: 'on-ride',
        },
        { session, new: true },
      ).lean();
      // console.log('driver status ongoing-order', updateDriver);
      if (!updateDriver) {
        // If the driver update fails, emit a response indicating ride rejection
        socket.emit('order-accept-response', 'order rejected');
        throw new Error('Order rejected');
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

      io.to(`${updatedOrder._id.toString()}-ride-room-pre`).emit(
        'accept-order-response',
        formatSocketResponse({
          message: `order accepted`,
          driverId: userId,
          order: updatedOrder,
          path: driverDataFromCurrLocationToPickup,
        }),
      );

      // socket.join(`${body.id.toString()}-ride-room`);
      // pubClient.publish(
      //   'join-rider-to-room',
      //   formatSocketResponse(updatedOrder),
      // );
      let retries = 0;
      let maxRetries = 3;
      async function fetchSocketsWithRetry() {
        try {
          const allDrivers = await io
            .in(`${updatedOrder._id.toString()}-ride-room-pre`)
            .fetchSockets();

          // Use allDrivers here
          allDrivers.forEach((element) => {
            element.leave(`${updatedOrder._id.toString()}-ride-room-pre`);
          });
          // throw new Error("failed to fetch socket")
        } catch (error) {
          if (retries < maxRetries) {
            console.log('Error fetching sockets. Retrying...');
            retries++;
            setTimeout(fetchSocketsWithRetry, 1000); // Retry after 1 second
          } else {
            // updatedRide = await Rides.findOneAndUpdate(
            //   { _id: new Types.ObjectId(body.id) },
            //   {
            //     driverId: _userId,
            //     status: 'cancelled',
            //   },
            //   { new: true },
            // ).lean();
            console.log('Max retries reached. Unable to fetch sockets.');
            // io.to(`${updatedRide._id.toString()}-ride-room-pre`).emit(
            //   'cancel-ride',
            //   formatSocketResponse({
            //     message: `Ride cancelled by server`,
            //     ride: updatedRide,
            //   }),
            // );
          }
        }
      }

      await fetchSocketsWithRetry();

      await session.commitTransaction();
    } catch (err: any) {
      console.log('err in ride-accept', err);

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
    console.log("Paymont done");
    const order = await PlaceOrder.findByIdAndUpdate(
      body._id,
      { 'order_details.payment_status': true },
      { new: true } // This option returns the modified document
    );
  })

  // update order --------
  socket.on('update-order-status', async (body: any) => {
    let session: any;
    let driverDataFromCurrLocationToPickup;
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
        let updateDriver = await Driver.findOneAndUpdate(
          { _id: _userId, rideStatus: 'on-ride' },
          {
            rideStatus: 'online',
          },
          { session, new: true },
        ).lean();

        socket.emit(
          'order-update-response',
          formatSocketResponse({
            message: 'order cancelled by customer',
            status: 405,
            driverId: userId,
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
          statusUpdates: newStatusUpdate,
        },
        { session, new: true },
      ).lean();

      // console.log('updated order>>>>>>>>>', updateOrder);

      if (updateOrder == null) {
        // If the order is not available for acceptance, emit an error response
        socket.emit(
          'order-update-response',
          formatSocketResponse({
            message: 'order not updated',
            status: 404,
            driverId: userId,
            order: updateOrder,
          }),
        );

        throw new Error('order-accept event error: Order not found!');
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
          socket.emit('order-update-response', 'driver not updated');
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

        driverDataFromCurrLocationToPickup = await getDirections(
          pickupLocation,
          dropLocation,
        );
      }

      socket.emit(
        'order-update-response',
        formatSocketResponse({
          message: `order updated`,
          driverId: userId,
          order: updateOrder,
          path: driverDataFromCurrLocationToPickup,
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

  // Event listener for socket disconnection
  socket.on('disconnect', async () => {
    console.log(`Driver ${userId} disconnected !`);
    delete driversSocket[userId];

    // Leave all rooms associated with the current socket
    socket.rooms.forEach((room) => {
      socket.leave(room);
    });
    try {
      // Update the driver's ride status to 'offline' upon socket disconnection
      await Driver.updateOne(
        {
          //todo: change mobileNumber to _id in future
          _id: _userId,
          rideStatus: 'online',
        },
        {
          rideStatus: 'offline',
        },
      );
    } catch (err: any) {
      console.error('Error while updating driver status:', err);
    }
  });
};
// Exporting functions and the event listener for reuse
export default driverSocketConnected;
export { getDriverSocket, setDriverSocket };
