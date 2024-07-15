import { Types } from 'mongoose';
import { Server, Socket } from 'socket.io';
import { getUtils, pubClient } from '..';
import { Driver, PlaceOrder, Riders, Rides, DriverLoginTime } from '../models';
import { formatSocketResponse, getDirections } from './common';
import { OrderStatusEnum } from '../shared/enums/status.enum';
import { log } from 'console';
import { update } from '../main/order';

// const { utilsData } = require('../index.ts');

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
    // Query the database to find a driver with the given userId and 'active' status
    const driverInfo = await Driver.findOne(
      {
        _id: _userId,
        status: 'active',
      },
      // Only retrieve the 'rideStatus' field from the document
      { rideStatus: 1 },
    ).lean();
    // If no valid driver info is found, emit an error event to the socket,
    // send an error message, disconnect the socket, and log a message
    if (!driverInfo) {
      throw new Error('Driver not valid or inactive');
    }

    // Set the driver's socket in the driversSocket object
    driversSocket[userId] = socket;
    // Check if the driver is currently on a ride
    let onGoingRide = await Rides.findOne({
      driverId: _userId,
      status: { $nin: ['completed', 'cancelled'] },
      rideType: 'default',
    });

    if (onGoingRide) {
      // If an ongoing ride is found, join the corresponding ride room
      socket.join(`${onGoingRide._id.toString()}-ride-room`);
      // Emit a ride-status event to the ride room
      socket.emit(
        'ride-status',
        formatSocketResponse({
          message: `Ongoing ride`,
          userId,
          onGoingRide: [onGoingRide],
        }),
      );
    } else {
      socket.emit(
        'ride-status',
        formatSocketResponse({
          message: `No active rides found!`,
          status: 404,
        }),
      );
      //   await Driver.findOneAndUpdate(
      //     {
      //       _id: _userId,
      //     },
      //     { rideStatus: 'online' },
      //   );
      // }

      // If driver is not on a ride, update the rideStatus to 'online'
      const updatedDriver = await Driver.findOneAndUpdate(
        { _id: _userId, rideStatus: { $ne: 'on-ride' } },
        { rideStatus: 'online' },
        { new: true },
      );

      // Check if the driver is eligible for any pending rides
      // todo: Implement a geo query to find nearby pending rides
      if (updatedDriver?.liveLocation) {
        const utilsdata = getUtils();
        const nearbyDriversDistanceInKm: any =
          utilsdata.nearbyDriversDistanceInKm;
        const nearbyDriversDistanceInRadians =
          nearbyDriversDistanceInKm / 111.12; //? Note: One degree is approximately 111.12 kilometers.
        // Find pending rides within the specified distance
        const pendingRides = await Rides.find({
          status: 'pending-accept',
          pickUpLocation: {
            $near: [
              updatedDriver?.liveLocation[1],
              updatedDriver?.liveLocation[0],
            ],
            $maxDistance: nearbyDriversDistanceInRadians,
          },
          bookingTime: { $exists: false },
        }).limit(10);

        if (pendingRides.length > 0) {
          // Join the ride rooms for each pending ride and emit a ride-request event
          pendingRides.forEach((element) => {
            socket.join(`${element._id.toString()}-ride-room-pre`);
          });
          socket.emit('ride-request', formatSocketResponse(pendingRides));
        }
      } else {
        throw new Error('Live Location is not updated..');
      }
    }

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
  socket.emit('test');
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
  socket.emit('accept-ride');
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
        socket.emit('ride-accept-response', 'ride rejected');
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
  socket.emit('reached-pickup'); //! ????
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
      session = await PlaceOrder.startSession();
      session.startTransaction();

      const driver_location = body.driverLoc;

      console.log("accept order request", body);


      if (!body.id) {
        // If order ID is missing in the request, handle the error
        throw new Error('OrderId is not found.');
      }
      // check if order is available for this driver
      const checkDriver: any = await Driver.findOne(
        { _id: _userId, rideStatus: 'on-ride' },
        { new: true },
      ).lean();
      if (checkDriver) {
        return;
        // throw new Error('Already on a ongoing order')
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
          $push: { statusUpdates: newStatusUpdate },
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

      updatedOrder = await PlaceOrder.findOneAndUpdate(
        {
          _id: new Types.ObjectId(body.id),
          status: OrderStatusEnum.ORDER_ALLOTTED
        },
        {
          riderPathToPickUp: driverDataFromCurrLocationToPickup?.coords,
        },
        { session, new: true },
      ).lean()


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
    // console.log(order);

  })
  
//   socket.on('driver-login-hours', async (body: any) => {
//     console.log("Login hours event received");

//     // Ensure userId is defined in the body
//     if (body && body.userId) {
//         console.log(body.userId);
//         update(userId,0.6)
//     } else {
//         console.error("userId is missing in the event body");
//     }
// });

  // update order --------
  socket.on('update-order-status', async (body: any) => {
    let session: any;
    let driverDataFromPickupToDrop;
    try {
      const { id, status } = body;

      session = await PlaceOrder.startSession();
      session.startTransaction();

      if (!body.id) {
        // If Order ID is missing in the request, handle the error
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
          $push: { statusUpdates: newStatusUpdate },
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
        // console.log('driver status online', updateDriver);
        if (!updateDriver) {
          // If the driver update fails, emit a response indicating ride rejection
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
          { session, new: true }
        ).lean()
      }

      // console.log("driverDataFromCurrLocationToPickup",driverDataFromCurrLocationToPickup);

      socket.emit(
        'order-update-response',
        formatSocketResponse({
          message: `order updated`,
          driverId: userId,
          order: updateOrder,
          path: driverDataFromPickupToDrop,
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

  // socket.on('emit-driver-live-location',async (body) => {
  //   let session: any;
  //   try {
  //     session = await Driver.startSession();
  //     session.startTransaction();
  //     if (!body.coordinates) {
  //       throw new Error('Coordinates are missing ');
  //     }

  //     /// Update the driver's live location in the database
  //     const updateLocation: any = await Driver.findOneAndUpdate(
  //       {
  //         _id: _userId,
  //       },
  //       {
  //         liveLocation: body.coordinates,
  //       },
  //       { session, new: true },
  //     );

  //     console.log("updateLocation", updateLocation  );

  //   } catch (err: any) {
  //     console.log('err in live-location', err);

  //     //! add proper error message. Or you can add status codes for every error message and handle frontend based on this errorcodes create enum for this.
  //     socket.emit(
  //       'error',
  //       formatSocketResponse({
  //         event: 'live-location',
  //         message: err.message,
  //       }),
  //     );
  //     if (session) {
  //       await session.abortTransaction();
  //     }
  //   } finally {
  //     if (session) {
  //       await session.endSession();
  //     }
  //   }
  // });

  // Event listener for socket disconnection


  socket.on('disconnect', async () => {
    console.log(`Driver ${userId} disconnected !`);

    // Remove the driver's socket from the driversSocket object
    delete driversSocket[userId];

    // Leave all rooms associated with the current socket
    socket.rooms.forEach((room) => {
      socket.leave(room);
    });
    try {
      // Update the driver's ride status to 'offline' upon socket disconnection
  //     await Driver.updateOne(
  //       {
  //         //todo: change mobileNumber to _id in future
  //         _id: _userId,
  //         rideStatus: 'online',
  //       },
  //       {
  //         rideStatus: 'offline',
  //       },
  //     );
    } catch (err: any) {
      console.error('Error while updating driver status:', err);
    }
  });
};

export async function fetchLast30DaysRecords(driverId: string) {
  try {
    // Calculate start date (30 days ago from today)
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);

    // Query documents based on driverId and date within the last 30 days
    const records = await DriverLoginTime.find({ driverId })
      .limit(30);
    let todayLoginHours = 0;
    let weekLoginHours = 0;
    let monthLoginHours = 0;

    for (let i = 0; i < records.length; i++) {
      const record = records[i];
     
      
      const loginHours: number = record.loginHours || 0;
      if (i === 0) {
        todayLoginHours = loginHours;
      }
      if (i < 7) {
        weekLoginHours += loginHours;
      }
      monthLoginHours += loginHours;
    }
    return {
      todayLoginHours,
      weekLoginHours,
      monthLoginHours
    };
  } catch (error) {
    console.error('Error fetching records:', error);
    throw error; // Handle the error appropriately in your application
  }
};


// Exporting functions and the event listener for reuse
export default driverSocketConnected;
export { getDriverSocket, setDriverSocket };


