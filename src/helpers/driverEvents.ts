import { Types } from 'mongoose';
import { Server, Socket } from 'socket.io';
import { pubClient } from '..';
import { Driver, PlaceOrder, Riders, Rides } from '../models';
import { OrderStatusEnum } from '../shared/enums/status.enum';
import { formatSocketResponse, getDirections } from './common';
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
) => {
  let _userId = new Types.ObjectId(userId);
  try {
    // Set the driver's socket in the driversSocket object
    driversSocket[userId] = socket;

    console.log('Socket connected successfully!', userId);

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

  socket.on('live-location', async (body) => {
    let session: any;
    try {
      session = await Rides.startSession();
      session.startTransaction();
      if (!body.coordinates) {
        throw new Error('Coordinates are missing ');
      }

      /// Update the driver's live location in the database
      const updateLocation: any = await Driver.findOneAndUpdate(
        {
          //todo: change mobileNumber to _id in future
          _id: _userId,
        },
        {
          liveLocation: body.coordinates,
        },
        { session, new: true },
      );
      // NOTE: 'body.rideId' - TRUE after ride-started.
      if (body.rideId) {
        // Emit the driver's live location to the rider's ride room
        socket.join(`${body.rideId.toString()}-ride-room`);
        io.to(`${body.rideId.toString()}-ride-room`).emit(
          'live-location',
          formatSocketResponse({
            message: `Driver live location`,
            coordinates: body.coordinates,
          }),
        );

        const rideDoc = await Rides.findOneAndUpdate(
          { _id: new Types.ObjectId(body.rideId) },
          {
            $push: {
              realPath: {
                latitude: body.coordinates[1],
                longitude: body.coordinates[0],
              },
            },
          },
          { session, new: true },
        ).lean();

        // Emit the driver's live location to the rider's ride room
        socket.join(`${body.rideId.toString()}-ride-room`);
        io.to(`${body.rideId.toString()}-ride-room`).emit(
          'live-location',
          formatSocketResponse({
            message: `Driver live location`,
            coordinates: body.coordinates,
            data: rideDoc,
          }),
        );
      }
      await session.commitTransaction();
    } catch (err: any) {
      console.log('err in live-location', err);

      //! add proper error message. Or you can add status codes for every error message and handle frontend based on this errorcodes create enum for this.
      socket.emit(
        'error',
        formatSocketResponse({
          event: 'live-location',
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

  // Event listener fo r accepting a ride request
  socket.emit('accept-ride', {});
  socket.on('ride-accept', async (body) => {
    console.log('---- ride-accept ----');

    let session: any;
    // todo: take driverId from token/ socket
    try {
      session = await Rides.startSession();
      session.startTransaction();

      if (!body.id) {
        // If ride ID is missing in the request, handle the error
        // todo: Consider sending an error response or handling it appropriately
        throw new Error('RideId is not found.');
      }
      // check if ride is available for this driver
      const checkDriver = await Driver.findOne(
        { _id: _userId, rideStatus: 'on-ride' },
        { new: true },
      ).lean();
      if (checkDriver) {
        return;
        // throw new Error('Already on a ride')
      }
      // Update the ride status to 'pending-arrival' and assign the driver
      let updatedRide: any = await Rides.findOneAndUpdate(
        { _id: new Types.ObjectId(body.id), status: 'pending-accept' },
        {
          driverId: _userId,
          status: 'pending-arrival',
        },
        { session, new: true },
      ).lean();
      if (updatedRide == null) {
        // If the ride is not available for acceptance, emit an error response
        socket.emit(
          'ride-accept-response',
          formatSocketResponse({
            message: 'ride not available',
            status: 404,
            driverId: userId,
            ride: updatedRide,
          }),
        );

        throw new Error('ride-accept event error: Ride not found!');
      }

      // Update the driver's ride status to 'on-ride'
      const updateDriver = await Driver.findOneAndUpdate(
        { _id: _userId, rideStatus: 'online' },
        {
          rideStatus: 'on-ride',
        },
        { session, new: true },
      ).lean();
      // console.log('driver status onride', updateDriver);
      if (!updateDriver) {
        // If the driver update fails, emit a response indicating ride rejection
        socket.emit('ride-accept-response', { message: 'ride rejected' });
        throw new Error('Ride rejected');
      }
      //* Fetching Data of Driver using getDirections() Google API & storing in Rides-Collection.
      const driverLocation = {
        latitude: updateDriver.liveLocation[1],
        longitude: updateDriver.liveLocation[0],
      };
      const pickupLocation = {
        latitude: updatedRide.pickUpLocation[0],
        longitude: updatedRide.pickUpLocation[1],
      };

      const driverDataFromCurrLocationToPickup = await getDirections(
        driverLocation,
        pickupLocation,
      );

      // Update the ride with driver's distance, duration, and path to pickup
      updatedRide = await Rides.findOneAndUpdate(
        { _id: new Types.ObjectId(body.id), status: 'pending-arrival' },
        {
          driverDistanceToPickUp: driverDataFromCurrLocationToPickup?.distance,
          driverDurationToPickUp: driverDataFromCurrLocationToPickup?.duration,
          driverPathToPickUp: driverDataFromCurrLocationToPickup?.coords,
          vehicleNumber: updateDriver?.vehicleNumber,
        },
        { session, new: true },
      ).lean();
      // console.log('updatedRide--->', updatedRide);
      io.to(`${updatedRide._id.toString()}-ride-room-pre`).emit(
        'ride-accept-response',
        formatSocketResponse({
          message: `Ride accepted`,
          driverId: userId,
          ride: updatedRide,
        }),
      );
      socket.join(`${body.id.toString()}-ride-room`);
      pubClient.publish(
        'join-rider-to-room',
        formatSocketResponse(updatedRide),
      );
      let retries = 0;
      let maxRetries = 3;
      async function fetchSocketsWithRetry() {
        try {
          const allDrivers = await io
            .in(`${updatedRide._id.toString()}-ride-room-pre`)
            .fetchSockets();

          // Use allDrivers here
          allDrivers.forEach((element) => {
            element.leave(`${updatedRide._id.toString()}-ride-room-pre`);
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
      // Remove other drivers from the ride room
      // let allDrivers = await io
      //   .in(`${updatedRide._id.toString()}-ride-room-pre`)
      //   .fetchSockets();

      // allDrivers.forEach((element) => {
      //   element.leave(`${updatedRide._id.toString()}-ride-room-pre`);
      // });
      // socket.join(`${body.id.toString()}-ride-room`);
      // pubClient.publish(
      //   'join-rider-to-room',
      //   formatSocketResponse(updatedRide),
      // );
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
    } finally {
      if (session) {
        await session.endSession();
      }
    }
  });

  // Event listener for when the driver has reached the pickup location
  socket.emit('reached-pickup', {}); //! ????
  socket.on('reached-pickup-location', async (body) => {
    console.log('---- reached-pickup-location ----');
    try {
      // Update the ride status to 'pending-otp' upon reaching pickup location
      let updatedRide = await Rides.findOneAndUpdate(
        { _id: new Types.ObjectId(body.rideId) },
        {
          status: 'pending-otp',
        },
        { new: true },
      ).lean();

      if (!updatedRide) {
        //! throw error on socket
        throw new Error('Driver not found.');
      }

      // Emit a ride-status event to the ride room to inform rider
      io.to(`${body.rideId.toString()}-ride-room`).emit(
        'ride-status',
        formatSocketResponse({
          message: `driver reached pickup-location`,
          data: updatedRide,
        }),
      );
    } catch (err: any) {
      console.log('err in reached-pickup-location', err);

      //! add proper error message. Or you can add status codes for every error message and handle frontend based on this errorcodes create enum for this.
      socket.emit(
        'error',
        formatSocketResponse({
          event: 'reached-pickup-location',
          message: err.message,
        }),
      );
    }
  });

  // Event listener for checking OTP during ride update
  socket.on('ride-update-otp-check', async (body) => {
    console.log('---- ride-update-otp-check ----');

    const { otp, rideId } = body;

    // Fetch the ride document to check the OTP
    let rideDoc: any = await Rides.findById(new Types.ObjectId(rideId)).lean();
    const rideOtp = rideDoc.otp;

    try {
      if (otp == rideOtp) {
        //! use proper messages to send on socket so the Ui will directly display the message coming from socket.
        // If OTP is valid, update the ride status to 'ride-started'
        io.to(`${rideDoc._id.toString()}-ride-room`).emit(
          'ride-update-otp-check',
          formatSocketResponse({ message: `Otp Verified` }),
        );
        let updatedRide: any = await Rides.findOneAndUpdate(
          { _id: new Types.ObjectId(rideId), status: 'pending-otp' },
          {
            status: 'ride-started',
          },
          { new: true },
        ).lean();

        // Emit a ride-status event to the ride room to inform rider about OTP verification
        io.to(`${rideDoc._id.toString()}-ride-room`).emit(
          'ride-status',
          formatSocketResponse({
            message: `OTP verified`,
            data: updatedRide,
          }),
        );

        if (!updatedRide) {
          //! thorw error on socket.
          throw new Error('Driver not found while pending-payment.');
        }
      } else {
        // If OTP is invalid, emit an event to indicate invalid OTP
        io.to(`${rideDoc._id.toString()}-ride-room`).emit(
          'ride-update-otp-check',
          formatSocketResponse({ message: `invalidOTP`, status: 403 }),
        );
      }
    } catch (err: any) {
      console.log('err in ride-update-otp-check', err);

      socket.emit(
        'error',
        formatSocketResponse({
          event: 'ride-update-otp-check',
          message: err.message,
        }),
      );
    }
  });

  // Event listener for general ride updates, such as completion of payment
  socket.on('ride-update', async (body) => {
    console.log('---- ride-update ----');

    if (body.message == 'reached destination') {
      try {
        // Update the ride status to 'pending-payment' upon reaching the destination
        let updatedRide: any = await Rides.findOneAndUpdate(
          { _id: new Types.ObjectId(body.rideId), status: 'ride-started' },
          {
            status: 'pending-payment',
          },
          { new: true },
        ).lean();

        if (!updatedRide) {
          //! thorw error on socket.
          throw new Error('Driver not found while payment-completion.');
        }

        // Emit a ride-status event to the ride room to inform about ride start
        io.to(`${updatedRide._id.toString()}-ride-room`).emit(
          'ride-status',
          formatSocketResponse({
            message: `ride started !`,
            data: updatedRide,
          }),
        );
      } catch (err: any) {
        console.log('err in ride-update', err);

        socket.emit(
          'error',
          formatSocketResponse({
            event: 'ride-update',
            message: err.message,
          }),
        );
      }
    }
  });

  // Event listener for when a payment is completed
  // ask
  socket.on('payment-completed', async (body) => {
    console.log('---- payment-completed ----');

    let session;

    try {
      session = await Rides.startSession();
      // Update the ride status to 'completed' upon successful payment completion
      session.startTransaction();
      let updatedRide: any = await Rides.findOneAndUpdate(
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
      const updateRider = await Riders.findByIdAndUpdate(
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
        .then((allRoomMembers) => {
          allRoomMembers.forEach((member) => {
            member.leave(`${updatedRide._id.toString()}-ride-room`);
          });
        })
        .catch((error) => {
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

  // Event listener to cancel a ride
  socket.on('cancel-ride', async (body: any) => {
    console.log('---- cancel-ride ----');

    let session: any;
    try {
      session = await Rides.startSession();
      session.startTransaction();
      // Check if the cancel-ride message is received
      if (body.message == 'cancel-ride') {
        let rideDoc = await Rides.findById(body.rideId);

        // Update the driver's ride status to 'online' after ride cancellation
        const updateDriver = await Driver.findByIdAndUpdate(
          rideDoc?.driverId,
          { rideStatus: 'online' },
          { session: session, new: true },
        ).lean();
        if (!updateDriver) {
          //! thorw error on socket.
          throw new Error(
            `DriverId ${rideDoc?.driverId} is not found while cancelling-ride.`,
          );
        }

        // Update the ride status to 'cancelled' in the database
        let updateRide = await Rides.findByIdAndUpdate(
          body.rideId,
          {
            status: 'cancelled',
            cancelBy: {
              id: userId,
              type: 'driver',
              reason: body.reason ? body.reason : null,
            },
          },
          { session: session, new: true },
        ).lean();
        if (!updateRide) {
          throw new Error(`Ride document not found.`);
        }

        if (rideDoc?.status == 'pending-accept') {
          // Emit cancel-ride event to inform other participants
          io.to(`${updateRide._id.toString()}-ride-room-pre`).emit(
            'cancel-ride',
            formatSocketResponse({
              message: `Ride cancelled by driver`,
              rideId: updateRide._id,
            }),
          );
          io.in(`${updateRide._id}-ride-room-pre`).socketsLeave(
            `${updateRide._id}-ride-room-pre`,
          );
        } else {
          io.to(`${updateRide._id.toString()}-ride-room`).emit(
            'cancel-ride',
            formatSocketResponse({
              message: `Ride cancelled by driver`,
              rideId: updateRide._id,
            }),
          );
          io.in(`${updateRide._id}-ride-room`).socketsLeave(
            `${updateRide._id}-ride-room`,
          );
        }
      }
      await session.commitTransaction();
    } catch (err: any) {
      console.log('err in cancel-ride', err);
      socket.emit(
        'error',
        formatSocketResponse({
          event: 'cancel-ride',
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

  socket.on('chat-message', async (body: any) => {
    try {
      if (body.message == 'New message from driver') {
        // console.log('New message from driver :>> ', body.chatMessage.text);
        // console.log('chat-message event body :>> ', body);

        let updateRide = await Rides.findByIdAndUpdate(
          new Types.ObjectId(body.rideId),
          {
            $push: { chatMessages: body.chatMessage },
            $inc: { riderUnreadMessagesCount: 1 },
            driverUnreadMessagesCount: 0,
          },
          { new: true },
        ).lean();
        // console.log(`chat-message >> updateRide :>> `, updateRide);

        if (!updateRide) {
          console.log('Rides not found while adding message of driver.');
          throw new Error(`Rides not found while adding message of driver.`);
        }

        io.to(`${updateRide._id.toString()}-ride-room`).emit(
          'chat-message',
          formatSocketResponse({
            message: `New message from driver`,
            rideId: updateRide._id,
            newChatMessage: body.chatMessage,
            allChatMessages: updateRide.chatMessages,
            status: 203, //Random code
          }),
        );
      }
    } catch (err: any) {
      console.log('err in chat-message', err);
      socket.emit(
        'error',
        formatSocketResponse({
          event: 'chat-message',
          message: err.message,
        }),
      );
    }
  });

  socket.on('all-chat-messages-seen', async (body: any) => {
    if (body.message == 'Driver has seen all messages') {
      // console.log('DRIVER all-chat-messages-seen event body :>> ', body);

      let updateRide = await Rides.findByIdAndUpdate(
        new Types.ObjectId(body.rideId),
        { driverUnreadMessagesCount: 0 },
        { new: true },
      ).lean();
      // console.log(`all-chat-messages-seen >> updateRide :>> `, updateRide);

      if (!updateRide) {
        console.log('Rides not found while updating messages-count of driver.');
        throw new Error(
          `Rides not found while updating messages-count of driver.`,
        );
      }
    }
  });

  /////////////// PetPooja Socket Implementation ////////////////////////////////////////////

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
      const driverData: any = await Driver.findOne(
        { _id: _userId },
        { new: true },
      ).lean();

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
                order: { _id: body.id, status:"ALLOTTED" },
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

      console.log('order accepted successfully');

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
