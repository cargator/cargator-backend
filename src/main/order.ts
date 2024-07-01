import mongoose from 'mongoose';
import { Driver, PlaceOrder } from '../models';
import { Earning } from '../models/earning.model';
import { Request, Response } from 'express';
import axios from 'axios';
import { error } from 'console';
import { getDirections } from '../helpers/common';
import { OrderStatusEnum } from '../shared/enums/status.enum';
import environmentVars from '../constantsVars';
import { checkOrders } from '..';

const petpoojaAcknowledge = async (data: any) => {
  try {
    return axios.post(environmentVars.PETPUJA_API_URL, data);
  } catch (error: any) {
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
    const { order_details } = req.body;

    console.log(
      JSON.stringify({
        method: 'placeOrder',
        message: 'place Order body.',
        data: req.body,
      }),
    );

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
        $in: [OrderStatusEnum.ORDER_CANCELLED, OrderStatusEnum.DELIVERED],
      },
    };

    if (filter) {

      if (filter.startDate && filter.endDate) {
        query.createdAt = {
          $gte: new Date(filter.startDate),
          $lte: new Date(filter.endDate),
        };
      } else if (filter.startDate) {
      console.log("filter is availble", filter.startDate, new Date(filter.startDate));
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
      const updatedAt = new Date(iterator.updatedAt);
      const createdAt = new Date(iterator.createdAt);
      const timeDifference = updatedAt.getTime() - createdAt.getTime();
      const totalminutes = Math.floor(timeDifference / 1000 / 60);

      resposne.push({
        orderId: iterator.order_details?.vendor_order_id,
        _id: iterator._id,
        status: iterator.status,
        date: iterator.createdAt,
        time: totalminutes,
        earning: 0,
        km: 0,
      });
    }

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
    console.log('userId ===> ', userId);
    const response = {
      message: 'Fetched all Order History!',
      data: {
        today: {
          earning: 456,
          loginHours: 50,
          orders: 10,
        },
        week: {
          earning: 4564,
          loginHours: 300,
          orders: 67,
        },
        month: {
          earning: 25766,
          loginHours: 4379,
          orders: 222,
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

function earingCalculate(data: any) {
  try {
  } catch (error: any) {
    console.log(error);
  }
}
