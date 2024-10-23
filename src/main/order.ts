import axios from 'axios';
import { Request, Response } from 'express';
import { PipelineStage, Types } from 'mongoose';
import { pubClient } from '..';
import { sendOrderNotification } from '../config/firebase-admin';
import constants from '../constantsVars';
import {
  calculateTotalDistance,
  convertMetersToKilometers,
  formatMillisecondsToHMS,
  formatSocketResponse,
  getDirections,
  getDirectionsUsingOlaMap,
} from '../helpers/common';
import { sendEmail } from '../helpers/sendEmail';
import { Driver } from '../models/driver.model';
import { PlaceOrder } from '../models/placeOrder.model';
import { Earning } from '../models/earning.model';
import { OrderStatusEnum } from '../shared/enums/status.enum';
import { getDriverDetails } from './driver';
import { Timeline } from '../models/timeline.model';
import { Flows } from '../models';
import { error } from 'console';
import { flow } from 'lodash';
import { Restaurant } from '../models/reataurant.model';
import mongoose from 'mongoose';

const petpoojaAcknowledge = async (data: any) => {
  try {
    console.log('petpoojaAcknowledge sent on order status updates', data);
    return axios.post(constants.PETPUJA_API_URL, data);
  } catch (error: any) {
    console.log('petpoojaAcknowledge error while updating order', error);
    throw new Error(error);
  }
};

// export async function getNewOrders(req: Request, res: Response) {
//     let session: any;
//     try {
//       session = await mongoose.startSession();
//       session.startTransaction();

//       let startDate: any = new Date();
//       let endDate: any = new Date();
//       //! confirm if this below statement is changing hour in corner cases.
//       endDate.setMinutes(endDate.getMinutes() - 10);

//       const newOrder = await PlaceOrder.find({
//         status: 'pending-accept',
//         bookingTime: {
//           $gte: endDate,
//         },
//       });

//       await session.commitTransaction();

//       res.status(200).send({
//         message: 'new orders get successfully.',
//         data: newOrder,
//       });
//     } catch (error: any) {
//       res.status(400).json({ success: false, message: error.message });
//       if (session) {
//         await session.abortTransaction();
//       }
//       console.log('err :>> ', error);
//     } finally {
//       if (session) {
//         await session.endSession();
//       }
//     }
// }

export async function placeOrder(req: Request, res: Response) {
  try {
    const newStatusUpdate = {
      status: OrderStatusEnum.ORDER_ACCEPTED,
      location: [],
      time: new Date(),
    };

    const pickupLocation = {
      latitude: req.body.pickup_details.latitude,
      longitude: req.body.pickup_details.longitude,
    };
    const dropLocation = {
      latitude: req.body.drop_details.latitude,
      longitude: req.body.drop_details.longitude,
    };

    const pickUpToDropDistance = await getDirectionsUsingOlaMap(
      pickupLocation,
      dropLocation,
    );

    const estimatedEarningFromPickupToDrop = (
      (pickUpToDropDistance?.distance / 1000) *
      10
    ).toFixed(2);

    const saveOrder: any = await PlaceOrder.create({
      ...req.body,
      status: OrderStatusEnum.ORDER_ACCEPTED,
      statusUpdates: [newStatusUpdate],
      order_details: {
        ...req.body.order_details,
        payment_status: req.body.order_details.paid,
      },
      ride_income: estimatedEarningFromPickupToDrop,
    });

    if (!saveOrder) {
      throw new Error('error while placing order');
    }

    const RiderDetails: any = await Driver.find({
      rideStatus: 'online',
    }).lean();

    // await sendEmail(req.body);

    pubClient.publish(
      'new-order',
      formatSocketResponse({
        order: saveOrder,
      }),
    );
    if (RiderDetails.length > 0) {
      for (const iterator of RiderDetails) {
        if (
          iterator.restaurantName ===
          saveOrder?.pickup_details?.name.toLowerCase().trim()
        ) {
          if (iterator.deviceToken) {
            await sendOrderNotification(iterator.deviceToken, saveOrder);
          } else {
            console.warn(
              `Device token is undefined for rider: ${iterator.firstName} ${iterator.lastName}`,
            );
          }
        }
      }
    }

    res.status(200).send({
      status: true,
      vendor_order_id: req.body.order_details.vendor_order_id,
      message: 'Order created',
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
    const driverId = 'ewgfbvgbve';
    const { driverLocation, pickUpDetails, id } = req.body;

    console.log(
      JSON.stringify({
        method: 'orderAccept',
        message: 'Order Accept Body',
        data: req.body,
      }),
    );

    // const driverData = await Driver.findOne({ _id: driverId }).lean();

    // if (!driverData) {
    //   console.log(
    //     JSON.stringify({
    //       method: 'orderAccept',
    //       message: 'Driver is not Found!',
    //       data: driverId,
    //     }),
    //   );

    //   res.status(404).send({
    //     status: true,
    //     driverId,
    //     message: 'Driver is not Found!',
    //   });
    // }

    // const pickUpLocation = {
    //   latitude: pickUpDetails.latitude, //latitude: 19.172141,
    //   longitude: pickUpDetails.longitude, //longitude: 72.956832
    // };

    // const driverDataFromCurrLocationToPickup = await getDirections(
    //   driverLocation,
    //   pickUpLocation,
    // );

    // const newStatusUpdate = {
    //   status: OrderStatusEnum.ORDER_ALLOTTED,
    //   time: new Date(),
    // };

    // const driverDetails = {
    //   driver_id: driverData?._id,
    //   name: driverData?.firstName,
    //   contact: driverData?.mobileNumber,
    // };

    // const response = await PlaceOrder.findOneAndUpdate(
    //   { _id: id },
    //   {
    //     status: OrderStatusEnum.ORDER_ALLOTTED,
    //     statusUpdates: newStatusUpdate,
    //     driver_details: driverDetails,
    //   },
    // ).lean();

    // if (response) {
    //   await Driver.findOneAndUpdate(
    //     { _id: driverId, rideStatus: 'online' },
    //     {
    //       rideStatus: 'on-ride',
    //     },
    //     { new: true },
    //   ).lean();
    // }

    const obj = {
      status: true,
      data: {
        api_key: constants.PETPUJA_API_KEY,
        api_secret_key: constants.PETPUJA_SECRET_KEY,
        vendor_order_id: 'abhjahhjga',
        rider_name: 'aghjasgjd',
        rider_contact: 'dshj',
      },
      message: 'Ok',
      status_code: OrderStatusEnum.ORDER_ALLOTTED,
    };

    const resp = await petpoojaAcknowledge(obj);

    console.log(
      JSON.stringify({
        method: 'orderAccept',
        message: 'order Accept Response',
        data: resp.data,
        // data: { response, driverDataFromCurrLocationToPickup },
      }),
    );
    res.status(200).send({
      message: 'Order accepted successfully.',
      // data: { response, driverDataFromCurrLocationToPickup },
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

// export async function orderUpdate(req: any, res: Response) {
//   try {
//     const { pickUpLocation, destination, orderId } = req.body;
//     const driverId = req.decoded.user._id;
//     let status = req.body.status;

//     console.log(
//       JSON.stringify({
//         method: 'orderUpdate',
//         message: 'order Update body',
//         data: req.body,
//       }),
//     );

//     const driverData = await Driver.findOne({ _id: driverId }).lean();
//     if (!driverData) {
//       console.log(
//         JSON.stringify({
//           method: 'orderUpdate',
//           message: 'Driver is not Found!',
//           data: {
//             driverId,
//           },
//         }),
//       );
//       res.status(404).send({
//         status: true,
//         driverId,
//         message: 'Driver is not Found!',
//       });
//     }

//     if (!Object.values(OrderStatusEnum).includes(status)) {
//       return res.status(400).send({ error: 'Invalid order status' });
//     }

//     status = status as OrderStatusEnum;
//     const driverDataFromCurrLocationToPickup = await getDirections(
//       pickUpLocation,
//       destination,
//     );

//     const newStatusUpdate = { status: status, time: new Date() };
//     const response = await PlaceOrder.findOneAndUpdate(
//       { _id: orderId },
//       { status: status, $push: { statusUpdates: newStatusUpdate } },
//       { new: true },
//     );

//     const obj = {
//       status: true,
//       data: {
//         api_key: constants.PETPUJA_API_KEY,
//         api_secret_key: constants.PETPUJA_SECRET_KEY,
//         vendor_order_id: response?.order_details?.vendor_order_id,
//         rider_name: response?.driver_details?.name,
//         rider_contact: response?.driver_details?.contact,
//       },
//       message: 'Ok',
//       status_code: response?.status,
//     };

//     await petpoojaAcknowledge(obj);

//     if (
//       status == OrderStatusEnum.DELIVERED &&
//       response &&
//       driverData?.rideStatus == 'on-ride'
//     ) {
//       await Driver.findOneAndUpdate(
//         { _id: driverId },
//         { rideStatus: 'online' },
//       );
//     }

//     console.log(
//       JSON.stringify({
//         method: 'orderUpdate',
//         message: 'order Update response',
//         data: {
//           status: response?.status,
//           vendor_order_id: response?.order_details?.vendor_order_id,
//         },
//       }),
//     );

//     res.status(200).send({
//       message: ' orders updated successfully.',
//       data: { response, driverDataFromCurrLocationToPickup },
//     });
//   } catch (error: any) {
//     console.log(
//       JSON.stringify({
//         method: 'orderUpdate',
//         message: error.message,
//       }),
//     );

//     res.status(400).send({ success: false, message: error.message });
//   }
// }

export async function trackOrderStatus(req: Request, res: Response) {
  try {
    const { vendor_order_id } = req.body;
    // const access_token = req.headers.access_token;

    // if (access_token != constants.PETPOOJA_ACCESS_TOKEN) {
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
            vendor_order_id,
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
        $push: { statusUpdates: newStatusUpdate },
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
        api_key: constants.PETPUJA_API_KEY,
        api_secret_key: constants.PETPUJA_SECRET_KEY,
        vendor_order_id: cancel_task?.order_details?.vendor_order_id,
        rider_name: cancel_task?.driver_details?.name,
        rider_contact: cancel_task?.driver_details?.contact,
      },
      message: 'Ok',
      status_code: OrderStatusEnum.ORDER_CANCELLED,
    };

    const resp = await petpoojaAcknowledge(obj);

    console.log('Acknowledgement response on Cancelled order', resp.data);

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

export async function getHistory(req: any, res: Response) {
  try {
    const userId = req.decoded.user._id;
    const { filter } = req.body;

    console.log(
      JSON.stringify({
        method: 'getHistory',
        message: 'get history data',
        data: { userId, filter },
      }),
    );

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    const skip = (page - 1) * limit;

    let query: any = {
      'driver_details.driver_id': userId,
      status: {
        // $in: [OrderStatusEnum.ORDER_CANCELLED, OrderStatusEnum.DELIVERED],
        $nin: [OrderStatusEnum.ORDER_CANCELLED],
      },
    };

    if (filter) {
      if (filter.startDate && filter.endDate) {
        query.createdAt = {
          $gte: new Date(filter.startDate),
          $lte: new Date(filter.endDate),
        };
      } else if (filter.startDate) {
        console.log(
          'filter is availble',
          filter.startDate,
          new Date(filter.startDate),
        );
        const startDate = new Date(filter.startDate);
        const nextDay = new Date(startDate);
        nextDay.setDate(startDate.getDate() + 1);
        query.createdAt = { $gte: startDate, $lt: nextDay };
      }
    }

    const orderData = await PlaceOrder.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // const earningData = await Earning.find({}).lean();

    const resposne = [];
    for (const iterator of orderData) {
      const acceptedAt = new Date(iterator.statusUpdates[1]?.time);
      const deliveredAt = new Date(
        iterator.statusUpdates[iterator.statusUpdates.length - 1]?.time,
      );
      const timeDifference = deliveredAt.getTime() - acceptedAt.getTime();
      const totalminutes = (timeDifference / 1000 / 60).toFixed(2);
      const travelledDistance = iterator?.travelled_distance || 0;
      const earning = iterator?.ride_income || 0;

      resposne.push({
        orderId: iterator.order_details?.vendor_order_id,
        _id: iterator._id,
        status: iterator.status,
        date: iterator.createdAt,
        time: totalminutes,
        earning: earning,
        dist: (travelledDistance / 1000).toFixed(2),
      });
    }

    console.log(
      JSON.stringify({
        method: 'fetchedAllOrderHistory!',
        message: 'Fetched all Order History Response',
        data: resposne,
      }),
    );

    res
      .send({
        message: 'Fetched all Order History!',
        data: resposne,
      })
      .status(200);
  } catch (error: any) {
    console.log(
      JSON.stringify({
        method: 'getHistory',
        message: error.message,
      }),
    );

    res.status(400).send({ success: false, message: error.message });
  }
}

export async function getProgress(req: any, res: Response) {
  const userId = req.decoded.user._id;
  try {
    const getProgressResult = await getProgressDetails(userId);

    const response = {
      message: 'Fetched all Order History!',
      data: {
        today: {
          earning: getProgressResult?.today.totalEarning || 0,
          totalDistance: convertMetersToKilometers(
            getProgressResult?.today.totalTravelDistance,
          ),
          loginHours:
            formatMillisecondsToHMS(getProgressResult?.today.totalOnrideTime) ||
            0,
          orders: getProgressResult?.today.count || 0,
        },
        week: {
          earning: getProgressResult?.week.totalEarning || 0,
          totalDistance: convertMetersToKilometers(
            getProgressResult?.week.totalTravelDistance,
          ),
          loginHours:
            formatMillisecondsToHMS(getProgressResult?.week.totalOnrideTime) ||
            0,
          orders: getProgressResult?.week.count || 0,
        },
        month: {
          earning: getProgressResult?.month.totalEarning || 0,
          totalDistance: convertMetersToKilometers(
            getProgressResult?.month.totalTravelDistance,
          ),
          loginHours:
            formatMillisecondsToHMS(getProgressResult?.month.totalOnrideTime) ||
            0,
          orders: getProgressResult?.month.count || 0,
        },
      },
    };

    res.send(response).status(200);
  } catch (error: any) {
    console.log(
      JSON.stringify({
        method: 'getProgress',
        message: error.message,
      }),
    );

    res.status(400).send({ success: false, message: error.message });
  }
}

async function saveEarning(data: any) {
  try {
    await Earning.create(data);
  } catch (error) {
    console.log(error);
  }
}

async function getProgressDetails(userId: string) {
  try {
    // Get today's date range
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    // Get this week's date range (Monday to Sunday)
    const currentDate = new Date();
    const currentDay = currentDate.getDay();
    const weekStart = new Date(currentDate);
    const weekEnd = new Date(currentDate);

    if (currentDay === 0) {
      // if today is Sunday
      weekStart.setDate(currentDate.getDate() - 6); // last Monday
      weekEnd.setDate(currentDate.getDate()); // today
      if (weekStart.getMonth() !== currentDate.getMonth()) {
        weekStart.setMonth(currentDate.getMonth());
        weekStart.setDate(1);
      }
    } else {
      weekStart.setDate(currentDate.getDate() - currentDay + 1); // this Monday
      weekEnd.setDate(currentDate.getDate() + (7 - currentDay)); // this Sunday

      if (weekStart.getMonth() !== currentDate.getMonth()) {
        weekStart.setMonth(currentDate.getMonth());
        weekStart.setDate(1);
      }

      if (weekEnd.getMonth() !== currentDate.getMonth()) {
        weekEnd.setMonth(currentDate.getMonth());
        weekEnd.setMonth(weekEnd.getMonth() + 1);
        weekEnd.setDate(0);
      }
    }

    weekStart.setHours(0, 0, 0, 0);
    weekEnd.setHours(23, 59, 59, 999);

    // Get this month's date range
    const monthStart = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth(),
      1,
    );
    monthStart.setHours(0, 0, 0, 0);
    const monthEnd = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth() + 1,
      0,
    );
    monthEnd.setHours(23, 59, 59, 999);
    // Aggregate query
    const result = await PlaceOrder.aggregate([
      {
        $match: {
          'driver_details.driver_id': userId,
          status: OrderStatusEnum.DELIVERED,
        },
      },
      {
        $facet: {
          today: [
            {
              $match: {
                createdAt: {
                  $gte: todayStart,
                  $lte: todayEnd,
                },
              },
            },
            /**
             * Calculating the time difference between the status 'ALLOTTED' and 'DELIVERED'.
             * This difference helps determine how much time the driver was "on-ride" from the moment
             * the delivery was assigned (ALLOTTED) until it was completed (DELIVERED).
             */

            {
              $addFields: {
                timeDifference: {
                  $subtract: [
                    { $arrayElemAt: ['$statusUpdates.time', -1] },
                    { $arrayElemAt: ['$statusUpdates.time', 1] },
                  ],
                },
              },
            },
            {
              $group: {
                _id: null,
                totalOnrideTime: { $sum: '$timeDifference' },
                totalTravelDistance: { $sum: '$travelled_distance' },
                totalEarning: { $sum: '$ride_income' },
                count: { $sum: 1 }, //gets completed ride's count
              },
            },
            {
              $project: {
                _id: 0,
                totalOnrideTime: 1,
                totalTravelDistance: 1,
                totalEarning: { $round: ['$totalEarning', 2] },
                count: 1,
              },
            },
          ],
          week: [
            {
              $match: {
                createdAt: {
                  $gte: weekStart,
                  $lte: weekEnd,
                },
              },
            },
            /**
             * Calculating the time difference between the status 'ALLOTTED' and 'DELIVERED'.
             * This difference helps determine how much time the driver was "on-ride" from the moment
             * the delivery was assigned (ALLOTTED) until it was completed (DELIVERED).
             */
            {
              $addFields: {
                timeDifference: {
                  $subtract: [
                    { $arrayElemAt: ['$statusUpdates.time', -1] },
                    { $arrayElemAt: ['$statusUpdates.time', 1] },
                  ],
                },
              },
            },
            {
              $group: {
                _id: null,
                totalOnrideTime: { $sum: '$timeDifference' },
                totalTravelDistance: { $sum: '$travelled_distance' },
                totalEarning: { $sum: '$ride_income' },
                count: { $sum: 1 }, //gets completed ride's count
              },
            },
            {
              $project: {
                _id: 0,
                totalOnrideTime: 1,
                totalTravelDistance: 1,
                totalEarning: { $round: ['$totalEarning', 2] },
                count: 1,
              },
            },
          ],
          month: [
            {
              $match: {
                createdAt: {
                  $gte: monthStart,
                  $lte: monthEnd,
                },
              },
            },
            /**
             * Calculating the time difference between the status 'ALLOTTED' and 'DELIVERED'.
             * This difference helps determine how much time the driver was "on-ride" from the moment
             * the delivery was assigned (ALLOTTED) until it was completed (DELIVERED).
             */
            {
              $addFields: {
                timeDifference: {
                  $subtract: [
                    { $arrayElemAt: ['$statusUpdates.time', -1] },
                    { $arrayElemAt: ['$statusUpdates.time', 1] },
                  ],
                },
              },
            },
            {
              $group: {
                _id: null,
                totalOnrideTime: { $sum: '$timeDifference' },
                totalTravelDistance: { $sum: '$travelled_distance' },
                totalEarning: { $sum: '$ride_income' },
                count: { $sum: 1 }, //gets completed ride's count
              },
            },
            {
              $project: {
                _id: 0,
                totalOnrideTime: 1,
                totalTravelDistance: 1,
                totalEarning: { $round: ['$totalEarning', 2] },
                count: 1,
              },
            },
          ],
        },
      },
      {
        $project: {
          today: {
            $ifNull: [
              { $arrayElemAt: ['$today', 0] },
              { totalOnrideTime: 0, count: 0 },
            ],
          },
          week: {
            $ifNull: [
              { $arrayElemAt: ['$week', 0] },
              { totalOnrideTime: 0, count: 0 },
            ],
          },
          month: {
            $ifNull: [
              { $arrayElemAt: ['$month', 0] },
              { totalOnrideTime: 0, count: 0 },
            ],
          },
        },
      },
    ]);
    return result[0];
  } catch (error: any) {
    console.log(
      JSON.stringify({
        method: 'getProgressDetailss',
        message: error.message,
      }),
    );

    throw new Error(error);
  }
}

export async function getOrderHistory(
  req: Request,
  res: Response,
): Promise<Response> {
  try {
    const page: number = parseInt(req.query.page as string, 10) || 1;
    const limit: number = parseInt(req.query.limit as string, 10) || 10;
    const filter: string | undefined = req.query.filter as string | undefined;
    const searchText: string | undefined = req.query.searchtext as
      | string
      | undefined;

      const sortedby:string= typeof req.query.sortedby === 'string' ? req.query.sortedby : "createdAt";
      const column_to_monogoattributes: { [key: string]: string } = {
        orderId: 'order_details.vendor_order_id',        
        customerMobileNum:'drop_details.contact_number',
        DriverMobileNum:'driver_details.contact',
        amount: 'order_details.order_total',
        pickUpLocation: 'pickup_details.address',
        dropLocation: 'drop_details.address',          
      }
      
      const order: 1 | -1 = (() => {
        const orderQuery = req.query.order;
      
        // Check if orderQuery is a string and parse it
        if (typeof orderQuery === 'string') {
          return parseInt(orderQuery) === 1 ? 1 : -1;
        }
      
        // Default to -1 if orderQuery is not a valid string
        return -1;
      })();
      const sortby=column_to_monogoattributes[sortedby]||'createdAt';
      
      const sortObject: Record<string, 1 | -1> = { [sortby]: order };
  

    console.log(
      JSON.stringify({
        method: 'getOrderHistory',
        message: 'get Order History Started',
        data: req.query,
      }),
    );

    let status: any;
    if (filter === 'completed') {
      status = [OrderStatusEnum.DELIVERED];
    } else if (filter === 'ongoing-rides' || filter === 'current-order') {
      status = [
        OrderStatusEnum.ORDER_ALLOTTED,
        OrderStatusEnum.DISPATCHED,
        OrderStatusEnum.ARRIVED,
        OrderStatusEnum.ARRIVED_CUSTOMER_DOORSTEP,
      ];
    } else if (filter === 'cancelled') {
      status = [OrderStatusEnum.ORDER_CANCELLED];
    } else {
      status = Object.values(OrderStatusEnum);
    }

    const dataLimit = limit;
    const skip = (page - 1) * dataLimit;
    const pipeline: PipelineStage[] = [];

    if (status) {
      if (typeof status === 'string') {
        pipeline.push({
          $match: {
            status: status,
            $or: [
              {
                // Prefix search for vendor_order_id if searchText is provided
                'order_details.vendor_order_id': {
                  $regex: `^${searchText}`, // Matches vendor_order_id that starts with the searchText
                  $options: 'i', // Case-insensitive
                },
              },
              {
                'drop_details.contact_number': {
                  $regex: `^${searchText}`,
                  $options: 'i',
                },
              },
              {
                'driver_details.contact': {
                  $regex: `^91${searchText}`, // Prefix search for searchText
                  $options: 'i',
                },
              },
              {
                'order_details.order_total': {
                  $regex: `${searchText}`, // Prefix search for searchText
                  $options: 'i',
                },
              },
              {
                'pickup_details.address': {
                  $regex: `${searchText}`,
                  $options: 'i',
                },
              },
              {
                'drop_details.address': {
                  $regex: `${searchText}`,
                  $options: 'i',
                },
              },
            ],
          },
        });
      } else {
        pipeline.push({
          $match: {
            status: { $in: status },
            $or: [
              {
                // Prefix search for vendor_order_id if searchText is provided
                'order_details.vendor_order_id': {
                  $regex: `^${searchText}`, // Matches vendor_order_id that starts with the searchText
                  $options: 'i', // Case-insensitive
                },
              },
              {
                'drop_details.contact_number': {
                  $regex: `^${searchText}`,
                  $options: 'i',
                },
              },
              {
                'order_details.order_total': {
                  $regex: `${searchText}`, // Prefix search for searchText
                  $options: 'i',
                },
              },
              {
                'driver_details.contact': {
                  $regex: `^91${searchText}`, // Prefix search for searchText
                  $options: 'i',
                },
              },
              {
                'pickup_details.address': {
                  $regex: `${searchText}`,
                  $options: 'i',
                },
              },
              {
                'drop_details.address': {
                  $regex: `${searchText}`,
                  $options: 'i',
                },
              },
            ],
          },
        });
      }
    }

    pipeline.push({
      $facet: {
        data: [
          {
            $sort: sortObject,
          },
          {
            $skip: skip,
          },
          {
            $limit: dataLimit,
          },
        ],
        count: [{ $count: 'totalcount' }],
      },
    });
    const orderHistory = await PlaceOrder.aggregate(pipeline);

    console.log(
      JSON.stringify({
        method: 'getOrderHistory',
        message: 'get Order History Response',
        data: req.query,
      }),
    );

    return res.status(200).json({
      message: 'Fetched all Orders',
      data: orderHistory,
    });
  } catch (error: any) {
    console.log('get all orderHistory error: ', error);
    return res.status(400).send({ error: error.message });
  }
}

export async function getOrderById(req: Request, res: Response) {
  try {
    const { id } = req.params;

    console.log(
      JSON.stringify({
        method: 'getOrderById',
        message: 'get Order By Id started',
        data: id,
      }),
    );

    const orderDetails: any = await PlaceOrder.findOne({
      'order_details.vendor_order_id': id,
    }).lean();

    if (!orderDetails) {
      return res.status(404).send({ error: 'Order not found' });
    }

    const driverData: any = await getDriverDetails({
      driver_id: orderDetails.driver_id,
    });

    if (!driverData) {
      return res.status(404).send({ error: 'Driver not found' });
    }

    const response = {
      ...orderDetails,
      vehicleNumber: driverData.vehicleNumber,
      vehicleName: driverData.vehicleName,
    };

    console.log(
      JSON.stringify({
        method: 'getOrderById',
        message: 'get Order By Id response',
        data: response,
      }),
    );

    return res.status(200).send({
      message: 'Fetched Order details successfully.',
      data: response,
    });
  } catch (error: any) {
    console.log('getOrderById error: ', error);
    res.status(400).send({ error: error.message });
  }
}

export async function getpendingOrders(req: any, res: Response) {
  let session: any;
  try {
    session = await mongoose.startSession();
    session.startTransaction();
    const userId = req.decoded.user._id;
    const restaurantName = req.decoded.user.restaurantName;
    const endDate = new Date(Date.now() - 10 * 60 * 1000);

    const driver = await Driver.findOne({
      _id: userId,
      rideStatus: { $ne: 'offline' },
    });

    if (driver) {
      const response = await PlaceOrder.find({
        status: OrderStatusEnum.ORDER_ACCEPTED,
        createdAt: { $gte: endDate },
      }).lean();

      const pendingOrders = response.filter(
        (order: any) =>
          order.pickup_details.name.toLowerCase().trim() == restaurantName,
      );

      await session.commitTransaction();

      const message = pendingOrders.length
        ? 'Fetched All Pending Orders.'
        : 'No Pending Orders';

      res.send({
        message,
        data: pendingOrders,
      });
    }
  } catch (error: any) {
    console.error('getPendingOrders error:', error);
    await session.abortTransaction();
    res.status(400).send({ error: error.message });
  } finally {
    session.endSession();
  }
}

export async function getDriversPendingOrders(req: any, res: Response) {
  try {
    const response = await PlaceOrder.findOne({
      $or: [
        {
          'driver_details.driver_id': req.decoded.user._id,
          status: {
            $nin: [OrderStatusEnum.ORDER_CANCELLED, OrderStatusEnum.DELIVERED],
          },
        },
        {
          'driver_details.driver_id': req.decoded.user._id,
          status: OrderStatusEnum.DELIVERED,
          'order_details.payment_status': false,
        },
      ],
    }).lean();

    return res.send({
      message: response ? 'Fetched My Pending Orders.' : 'No Pending Orders',
      data: response,
    });
  } catch (error: any) {
    return res.status(400).send({ error: error.message });
  }
}

export async function updatePaymentStatusOfOrder(req: any, res: Response) {
  try {
    const userId = req.decoded.user._id;
    const { id, status } = req.body;
    if (!id) {
      throw new Error('OrderId is not found.');
    }

    await PlaceOrder.findByIdAndUpdate(new Types.ObjectId(id), {
      $set: { 'order_details.payment_status': status },
    }).lean();

    await Driver.findOneAndUpdate(
      { _id: userId, rideStatus: 'on-ride' },
      { rideStatus: 'online' },
    ).lean();

    return res.status(200).send({
      message: 'Order status updated',
    });
  } catch (error: any) {
    return res.status(400).send({ error: error.message });
  }
}

export async function orderUpdateStatus(req: any, res: Response) {
  let session: any;
  try {
    const userId = req.decoded.user._id;
    const { id, status, location } = req.body;
    // const { id, status } = req.body;

    console.log('update status :>>>>>', status);

    if (!id) {
      throw new Error('OrderId is not found.');
    }

    if (!Object.values(OrderStatusEnum).includes(status)) {
      throw new Error('Invalid order status');
    }

    session = await PlaceOrder.startSession();
    session.startTransaction();
    const order = await PlaceOrder.findById(new Types.ObjectId(id))
      .session(session)
      .lean();
    if (!order) {
      await session.abortTransaction();
      return res.status(404).send({ message: 'Order not found' });
    }

    if (order.status === OrderStatusEnum.ORDER_CANCELLED) {
      await Driver.findOneAndUpdate(
        { _id: userId, rideStatus: 'on-ride' },
        { rideStatus: 'online' },
        { session, new: true },
      ).lean();

      await session.commitTransaction();
      return res.send({
        message: 'Order cancelled by customer',
        data: { driverId: userId, order: order },
      });
    }

    // if order already delivered and response didn't get by any reason
    if (order.status === OrderStatusEnum.DELIVERED) {
      return res.send({
        message: 'Order already delivered',
        data: { driverId: userId, order: order },
      });
    }
    
    let updateFields: any = {
      status,
      $push: {
        statusUpdates: {
          status,
          location: [location?.latitude, location?.longitude],
          time: new Date(),
        },
      },
    };

    if (
      status === OrderStatusEnum.DELIVERED
      // &&
      // order.order_details?.paid === true
    ) {
      const totalDistance = calculateTotalDistance(order.realPath);
      console.log('totalDistance ===> ', totalDistance);

      // const rideIncome = parseFloat(
      //   (convertMetersToKilometers(totalDistance) * 10).toFixed(2),
      // );

      updateFields = {
        ...updateFields,
        travelled_distance: totalDistance,
      };

      // console.log('updateFields ==> ', updateFields);

      const updateDriver = await Driver.findOneAndUpdate(
        { _id: userId, rideStatus: 'on-ride' },
        { rideStatus: 'online' },
        { session, new: true },
      ).lean();

      console.log('updateDriver ===> ', updateDriver);
      if (!updateDriver) {
        await session.abortTransaction();
        return res.status(404).send({ message: 'Driver status not updated' });
      }
    }

    let updateOrder: any = await PlaceOrder.findByIdAndUpdate(
      new Types.ObjectId(id),
      updateFields,
      { session, new: true },
    ).lean();

    if (status === OrderStatusEnum.DISPATCHED) {
      const pickupLocation = {
        latitude: updateOrder.pickup_details.latitude,
        longitude: updateOrder.pickup_details.longitude,
      };
      const dropLocation = {
        latitude: updateOrder.drop_details.latitude,
        longitude: updateOrder.drop_details.longitude,
      };
      const driverDataFromPickupToDrop = await getDirections(
        pickupLocation,
        dropLocation,
      );

      updateOrder = await PlaceOrder.findByIdAndUpdate(
        new Types.ObjectId(id),
        { pickupToDrop: driverDataFromPickupToDrop?.coords },
        { session, new: true },
      ).lean();
    }

    const obj = {
      status: true,
      data: {
        api_key: constants.PETPUJA_API_KEY,
        api_secret_key: constants.PETPUJA_SECRET_KEY,
        vendor_order_id: updateOrder?.order_details?.vendor_order_id,
        rider_name: updateOrder?.driver_details?.name,
        rider_contact: updateOrder?.driver_details?.contact,
      },
      message: 'Ok',
      status_code: updateOrder?.status,
    };

    console.log('obj === >', obj);

    const acknowledgementResponse = await petpoojaAcknowledge(obj);

    console.log(
      'Order update acknoeledgement response',
      acknowledgementResponse.data,
    );

    await session.commitTransaction();
    return res.status(200).send({
      message: 'Order status updated',
      data: { order: updateOrder },
    });
  } catch (error: any) {
    console.error('orderUpdateStatus error:', error);
    await session.abortTransaction();
    return res.status(400).send({ error: error.message });
  } finally {
    session.endSession();
  }
}

function getFormattedDateTime() {
  return new Date()
    .toISOString()
    .replace(/[-:T.]/g, '')
    .slice(0, 14);
}

export async function testOrder(req: Request, res: Response) {
  try {
    const venderId = getFormattedDateTime();
    const testingData = {
      drop_details: {
        address: 'mulund east,Ahmedabad',
        city: 'Ahmedabad',
        contact_number: '9833535250',
        latitude: 23.022505,
        longitude: 72.5713621,
        name: 'navnath Parte',
      },
      order_details: {
        customer_orderId: '',
        order_source: 'POS',
        order_total: 359,
        paid: 'false',
        vendor_order_id: venderId,
        payment_status: 'false',
      },
      order_items: [
        {
          id: 233,
          name: 'Chicken Drumsticks (3 Pieces)',
          price: 359,
          quantity: 1,
        },
        {
          id: 233,
          name: 'Chicken Drumsticks (3 Pieces)',
          price: 359,
          quantity: 1,
        },
      ],
      pickup_details: {
        address: 'ahmedabad',
        city: 'Ahmedabad',
        contact_number: '1234567890',
        latitude: '19.172141',
        longitude: '72.956832',
        name: 'HO Demo - Sumit Bhatiya - Delivery Integration',
      },
      status: OrderStatusEnum.ORDER_ACCEPTED,
    };

    const saveOrder: any = await PlaceOrder.create(testingData);

    const RiderDetails: any = await Driver.find({
      rideStatus: 'online',
    }).lean();

    if (!saveOrder) {
      throw new Error('error while placing order');
    }

    // await sendEmail(req.body);

    pubClient.publish(
      'new-order',
      formatSocketResponse({
        order: saveOrder,
      }),
    );

    for (const iterator of RiderDetails) {
      if (
        iterator.restaurantName ===
        saveOrder?.pickup_details?.name.toLowerCase().trim()
      ) {
        if (iterator.deviceToken) {
          await sendOrderNotification(iterator.deviceToken, saveOrder);
        } else {
          console.warn(
            `Device token is undefined for rider: ${iterator.firstName} ${iterator.lastName}`,
          );
        }
      }
    }

    return res.send({ status: true, messgae: 'order Placed', data: saveOrder });
  } catch (error: any) {
    console.log('testOrder', error.message);
    return res.send({ error: error.message });
  }
}

export async function getButtontextFlow(req: Request, res: Response) {
  try {
    const flows = await Flows.find().lean().sort({ sequenceNo: 1 });

    if (!flows || flows.length === 0) {
      throw new Error('Flows not found!');
    }

    // console.log('Button Text flow fetched successfully!', { flows });

    return res.status(200).json({
      message: 'Flows fetched successfully',
      data: flows,
    });
  } catch (error: any) {
    console.error('get flows error: ', error);
    return res.status(500).json({
      message: 'Error fetching flows',
      error: error.message,
    });
  }
}

export async function updateFoodImageKey(req: Request, res: Response) {
  try {
    const { vendor_order_id, status, imageKey, latLong } = req.body;

    const updateFields =
      status === 'ARRIVED'
        ? {
            'foodImageKey.pickUpImageKey': imageKey,
            'foodImageKey.pickUpLocation.latitude': latLong?.latitude,
            'foodImageKey.pickUpLocation.longitude': latLong?.longitude,
          }
        : {
            'foodImageKey.dropImageKey': imageKey,
            'foodImageKey.dropLocation.latitude': latLong?.latitude,
            'foodImageKey.dropLocation.longitude': latLong?.longitude,
          };

    const response: any = await PlaceOrder.findOneAndUpdate(
      { 'order_details.vendor_order_id': vendor_order_id },
      { $set: updateFields },
    ).lean();

    return res.status(200).json({
      message: 'image key uploaded successfully',
      data: response,
    });
  } catch (error: any) {
    console.error('get image key error: ', error);
    return res.status(500).json({
      message: 'Error when uploading image key ',
      error: error.message,
    });
  }
}
