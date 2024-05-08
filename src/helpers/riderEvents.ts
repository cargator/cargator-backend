import { pick } from 'lodash';
import { Types } from 'mongoose';
import { Server, Socket } from 'socket.io';
import { getUtils, pubClient } from '..';
import { Driver, Riders, Rides } from '../models';
import { formatSocketResponse } from './common';


import constants from '../constantsVars';

// import { utilsdata } from '../index'
const riderSockets: Record<string, Socket> = {};

// Function to retrieve rider's socket instance
const getRiderSocket = (userId: string): Socket => {
  return riderSockets[userId];
};

// Function to set rider's socket instance
const setRiderSocket = (userId: string, socket: Socket): Socket => {
  riderSockets[userId] = socket;
  return socket;
};

// Event listener for when a rider's socket is connected
const riderSocketConnected = async (
  socket: Socket,
  userId: string,
  io: Server,
) => {
  let _userId = new Types.ObjectId(userId);
  // let cronRideTime: any = constants.PREBOOK_RIDES_TIME;
  let cronRideTime: any = getUtils().preBookRideTime;
  cronRideTime = parseInt(cronRideTime);
  try {
    const riderInfo = await Riders.findOne(
      {
        _id: _userId,
        status: { $in: ['active', 'on-ride'] },
      },
      { _id: 1 },
    );

    // Handle case when rider is not valid
    if (!riderInfo) {
      socket.disconnect();
      throw new Error(`Socket Disconnected ! Rider not valid.`);
    }
    // Store rider's socket instance
    riderSockets[userId] = socket;

    // Check for any ongoing rides
    let onGoingRide = await Rides.find({
      riderId: _userId,
      // status: { $ne: 'completed' },
      // status: { $nin: ['completed', 'cancelled'] },
      status: {
        $in: [
          'pending-accept',
          'pending-arrival',
          'ride-started',
          'pending-otp',
          'pending-payment',
          'payment-failed',
        ],
      },
      
    });
    console.log(`\nrider-connect onGoingRide :>> `, onGoingRide);

    if (onGoingRide.length) {
      for (const ride of onGoingRide) {
        if (ride.status === 'pending-accept' && ride.bookingTime) {
          let currentDate = new Date();
          currentDate.setMinutes(currentDate.getMinutes() + cronRideTime);
          // IF it's a Scheduled-Ride, then continue:
          if (new Date(ride.bookingTime) > currentDate) {
            continue;
          } else {
            // Join the ride room and emit ride-status event
            socket.join(`${ride._id.toString()}-ride-room`);
            socket.emit(
              'ride-status',
              formatSocketResponse({
                message: `Please complete existing ride`,
                userId,
                data: ride,
              }),
            );
          }
        }
        // ELSE emit the ongoing-ride:
        else {
          // Join the ride room and emit ride-status event
          socket.join(`${ride._id.toString()}-ride-room`);
          socket.emit(
            'ride-status',
            formatSocketResponse({
              message: `Please complete existing ride`,
              userId,
              data: ride,
            }),
          );
        }
      }
    } else {
      socket.emit(
        'ride-status',
        formatSocketResponse({
          status:404,
          message: `No active ride found!`,
        }),
      );
    }
  } catch (err: any) {
    throw new Error(err);
  }

  // Event listener for requesting a new ride
  socket.on('request-ride', async (body: any) => {
    // validation for ongoing ride, rider can only request for new ride if old ride is completed
    try {
      console.log('request-ride event body :>>', body);

      // merge
      let onGoingRide = await Rides.find({
        riderId: _userId,
        // status: { $ne: 'completed' },
        // status: { $nin: ['completed', 'cancelled'] },
        status: {
          $in: [
            'pending-accept',
            'pending-arrival',
            'ride-started',
            'pending-otp',
            'pending-payment',
          ],
        },
        
      });


      if (onGoingRide.length) {
        //! Only one ride can be booked per-day.
        if (body.bookingTime) {
                    const nextDayOfBooking = new Date(
            new Date(body.bookingTime).getTime() + 24 * 60 * 60 * 1000,
          );
          const previousDayOfBooking = new Date(
            new Date(body.bookingTime).getTime() - 24 * 60 * 60 * 1000,
          );

          let rideBookedOnSameDay = await Rides.find({
            riderId: _userId,
            status: 'pending-accept',
            bookingTime: {
              $gte: previousDayOfBooking,
              $lte: nextDayOfBooking,
            },
          });
          if (rideBookedOnSameDay.length > 0) {
            socket.emit(
              'ride-request-response',
              formatSocketResponse({
                message: 'You have already booked a ride!',
                status:409
              }),
            );
            return;
          }
        } else {
          const nextDayOfBooking = new Date(
            new Date().getTime() + 24 * 60 * 60 * 1000,
          );
          const today = new Date();
          let rideBookedOnSameDay: any = await Rides.find({
            riderId: _userId,
            status: 'pending-accept',
            bookingTime: {
              $gt: today,
              $lte: nextDayOfBooking,
            },
          });
          if (rideBookedOnSameDay.length > 0) {
            socket.emit(
              'ride-request-response',
              formatSocketResponse({
                message: 'Already have an scheduled ride within 24 hrs',
                status:409
              }),
            );
            return;
          }
          // else {
          //   for (const ride of onGoingRide) {
          //     if (ride.status === 'pending-accept' && ride.bookingTime) {
          //       let currentDate = new Date();
          //       currentDate.setMinutes(currentDate.getMinutes() + cronRideTime);

          //       // IF it's a Scheduled-Ride, then continue:
          //       if (new Date(ride.bookingTime) > currentDate) {
          //         // console.log(`IF it's a Scheduled-Ride, then continue:`);
          //         // continue; // Use "CONTINUE" when we can have multiple-rides scheduled by a single-rider.

          //         // Use below-code when only one ride can be booked by a rider.
          //         socket.emit(
          //           'ride-request-response',
          //           formatSocketResponse({
          //             message: 'one ride already booked',
          //           }),
          //         );
          //         return;
          //       }
          //       // ELSE emit the ongoing-ride:
          //       else {
          //         // console.log('ELSE emit the ongoing-ride:');
          //         socket.emit(
          //           'ride-request-response',
          //           formatSocketResponse({
          //             message: 'Please complete existing ride',
          //             data: ride,
          //           }),
          //         );
          //         return;
          //       }
          //     }
          //     // ELSE emit the ongoing-ride [Here, ride is ongoing]:
          //     else {
          //       // console.log('ELSE emit the ongoing-ride:');
          //       socket.emit(
          //         'ride-request-response',
          //         formatSocketResponse({
          //           message: 'Please complete existing ride',
          //           data: ride,
          //         }),
          //       );
          //       return;
          //     }
          //   }
          // }
        }
        // Emit error response if an ongoing ride exists, only if it's not a scheduled-ride
      }

      // Pick relevant ride details from the request body
      let rideDetails = pick(body, [
        'pickUpLocation',
        'dropLocation',
        'pickUpAddress',
        'dropAddress',
        'platform',
        'distance',
        'duration',
        'pickupToDropPath',
        'fare',
        'paymentMode',
        'bookingTime',
      ]);

      // Generate a random 4-Digit OTP.
      const randomNumber = Math.floor(1000 + Math.random() * 9000);

      // Create a new ride document
      let newRide: any = await Rides.create({
        ...rideDetails,
        riderId: _userId,
        status: 'pending-accept',
        otp: randomNumber,
        // 
      });
      // console.log(`request-ride newRide :>> `, newRide);

      if (!newRide) {
        throw new Error(
          'Invalid data provided while creating newRide document.',
        );
      }

      if (newRide.bookingTime) {
        // console.log('Ride is being booked!');
        let currentDate = new Date();
        // console.log(`currentDate :>> `, currentDate);

        currentDate.setMinutes(currentDate.getMinutes() + cronRideTime);
        // console.log(`After 15 minutes currentDate :>> `, currentDate);

        if (new Date(newRide.bookingTime) > currentDate) {
          // console.log('Ride is booked for later ! Returning !!');

          socket.emit(
            'ride-status',
            formatSocketResponse({
              message: `ride scheduled successfully`,
              data: newRide,
            }),
          );
          return; // Return so, CRON will handle the booked-ride later.
        }
      }

      // Emit ride-request-response event with the new ride details
      socket.emit(
        'ride-request-response',
        formatSocketResponse({
          message: 'Ride requested',
          data: newRide,
        }),
      );

      // Find available drivers for the new ride within a certain radius
      const utilsdata = getUtils();
      const nearbyDriversDistanceInKm: any =
        utilsdata.nearbyDriversDistanceInKm;
      const nearbyDriversDistanceInRadians = nearbyDriversDistanceInKm / 111.12; // Note: One degree is approximately 111.12 kilometers.
      // find drivers available to accept new ride
      const availableDrivers = await Driver.find({
        rideStatus: 'online', // is acceptingRides(online) or not (offline)
        status: 'active', // drivers current ride status i.e if on a ride(on-ride) or free(active)
        liveLocation: {
          // $near: [72.9656312, 19.1649861],
          $near: [rideDetails.pickUpLocation[1], rideDetails.pickUpLocation[0]],
          $maxDistance: nearbyDriversDistanceInRadians,
        },
      })
        .limit(20)
        .lean();
      const data = { ride: newRide, drivers: availableDrivers };
      console.log('availableDrivers------>', availableDrivers?.length);
      // Publish a message to join available drivers to a room
      pubClient.publish(
        'join-availableDrivers-to-room',
        formatSocketResponse(data),
      );
      // availableDrivers.forEach((driver) => {
      //   let tempDriverId = driver._id.toString();
      //   const driversSocket = getDriverSocket(tempDriverId);
      //   if (driversSocket) {
      //     driversSocket.emit('ride-request', formatSocketResponse([newRide]));
      //     driversSocket.join(`${newRide._id.toString()}-ride-room`);
      //   }
      // });
    } catch (err: any) {
      console.log('err in request-ride', err);

      socket.emit(
        'error',
        formatSocketResponse({
          event: 'request-ride',
          message: err.message,
        }),
      );
    }
  });

  // Event listener to find nearby drivers available to accept new rides
  socket.on('nearby-drivers', async (body: any) => {
    try {
      // find drivers available to accept new ride using geoquery.
      const utilsdata = getUtils();
      const nearbyDriversDistanceInKm: any =
        utilsdata.nearbyDriversDistanceInKm;

      // const nearbyDriversDistanceInKm = 5; // To get eligible-drivers within "5" Km. Edit this for differnt distance in Km.
      const nearbyDriversDistanceInRadians = nearbyDriversDistanceInKm / 111.12; // Note: One degree is approximately 111.12 kilometers.
      const availableDrivers = await Driver.find({
        rideStatus: 'online', // is acceptingRides(online) or not (offline)
        status: 'active', // drivers current ride status i.e if on a ride(on-ride) or free(active)
        liveLocation: {
          // $near: [72.9656312, 19.1649861],
          $near: [body.location.longitude, body.location.latitude],
          $maxDistance: nearbyDriversDistanceInRadians,
        },
      })
        .limit(5)
        .lean();
      if (!availableDrivers) {
        throw new Error('No Driver Available');
      }
      // Create an array of available drivers' coordinates
      const availableDriversCoords: any = [];
      availableDrivers.forEach((driver) => {
        availableDriversCoords.push({
          latitude: driver.liveLocation[1],
          longitude: driver.liveLocation[0],
        });
      });

      // Emit nearby-drivers event with the list of available drivers' coordinates
      socket.emit(
        'nearby-drivers',
        formatSocketResponse({
          message: 'available drivers nearby',
          data: { nearbyDrivers: availableDriversCoords },
        }),
      );
    } catch (err: any) {
      console.log('err in nearby-drivers', err);

      socket.emit(
        'error',
        formatSocketResponse({
          event: 'nearby-drivers',
          message: err.message,
        }),
      );
    }
  });

  // Event listener to cancel a ride
  //! RETHINK ON THE CANCEL RIDE LOGIC
  socket.on('cancel-ride', async (body: any) => {
    let session: any;
    try {
      session = await Rides.startSession();
      session.startTransaction();
      // Check if the cancel-ride message is received
      if (body.message == 'cancel-ride') {
        let rideDoc = await Rides.findById(body.rideId);

        // Update the driver's ride status to 'online' after ride cancellation
        if (rideDoc?.status != 'pending-accept') {
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
        }

        // Update the ride status to 'cancelled' in the database
        let updateRide = await Rides.findByIdAndUpdate(
          body.rideId,
          {
            status: 'cancelled',
            cancelBy: {
              id: userId,
              type: 'rider',
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
              message: `Ride cancelled by rider`,
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
              message: `Ride cancelled by rider`,
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

  socket.on('payment-completed', async (body) => {
    let session;

    try {
      session = await Rides.startSession();
      // Update the ride status to 'completed' upon successful payment completion
      session.startTransaction();
      let updatedRide: any = await Rides.findOneAndUpdate(
        {
          _id: new Types.ObjectId(body.rideId),
          status: 'pending-payment',
          paymentMode: 'Online',
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
        }),
      );

      // Update the driver's ride status to 'online' after ride completion & increment 'totalRidesCompleted' count.
      const updateDriver = await Driver.updateOne(
        { _id: updatedRide.driverId, rideStatus: 'on-ride' },
        {
          rideStatus: 'online',
          $inc: { totalRidesCompleted: 1 },
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
        { session: session, new: true },
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

  socket.on('chat-message', async (body: any) => {
    try {
      if (body.message == 'New message from rider') {
        // console.log('New message from rider :>> ', body.chatMessage.text);

        let updateRide = await Rides.findByIdAndUpdate(
          new Types.ObjectId(body.rideId),
          {
            $push: { chatMessages: body.chatMessage },
            $inc: { driverUnreadMessagesCount: 1 },
            riderUnreadMessagesCount: 0,
          },
          { new: true },
        ).lean();
        if (!updateRide) {
          throw new Error(`Rides not found while adding message of rider.`);
        }

        io.to(`${updateRide._id.toString()}-ride-room`).emit(
          'chat-message',
          formatSocketResponse({
            message: `New message from rider`,
            status: 203,
            rideId: updateRide._id,
            newChatMessage: body.chatMessage,
            allChatMessages: updateRide.chatMessages,
          }),
        );
      }
    } catch (error: any) {
      console.log('error in chat-message', error);
      socket.emit(
        'error',
        formatSocketResponse({
          message: error.message,
        }),
      );
    }
  });

  socket.on('all-chat-messages-seen', async (body: any) => {
    if (body.message == 'Rider has seen all messages') {
      // console.log('RIDER all-chat-messages-seen event body :>> ', body);

      let updateRide = await Rides.findByIdAndUpdate(
        new Types.ObjectId(body.rideId),
        { riderUnreadMessagesCount: 0 },
        { new: true },
      ).lean();
      // console.log(`all-chat-messages-seen >> updateRide :>> `, updateRide);

      if (!updateRide) {
        console.log('Rides not found while updating messages-count of rider.');
        throw new Error(
          `Rides not found while updating messages-count of rider.`,
        );
      }
    }
  });

  socket.on('change-payment-mode', async (body: any) => {
    try {
      const changedPaymentMode =
        body.paymentMode === 'Cash' ? 'Online' : 'Cash';

      let updateRide = await Rides.findByIdAndUpdate(
        new Types.ObjectId(body.rideId),
        { paymentMode: changedPaymentMode },
        { new: true },
      ).lean();

      if (!updateRide) {
        throw new Error(`Ride not found while changing payment mode !`);
      }

      io.to(`${updateRide._id.toString()}-ride-room`).emit(
        'change-payment-mode',
        formatSocketResponse({
          message: `rider changed payment mode`,
          data: updateRide,
        }),
      );
    } catch (error: any) {
      console.log('err in change-payment-mode', error);

      socket.emit(
        'error',
        formatSocketResponse({
          message: error.message,
        }),
      );
    }
  });

  // Event listener for the 'disconnect' event
  socket.on('disconnect', async () => {
    console.log('rider disconnected --> ', userId);

    // Remove the rider socket from the list of active rider sockets
    delete riderSockets[userId];
    // let userId = new Types.ObjectId(userId);
    // try {
    //   const rides = await Rides.findOneAndUpdate(
    //     { riderId: userId, status: 'pending-accept' },
    //     { status: 'cancelled' },
    //     { new: true },
    //   );
    // } catch (error) {
    //   console.error(error);
    // }

    // Leave all the rooms that the socket was part of
    socket.rooms.forEach((room) => {
      socket.leave(room);
    });
  });
};

// Export the riderSocketConnected function and rider socket management functions
export default riderSocketConnected;
export { getRiderSocket, setRiderSocket };
