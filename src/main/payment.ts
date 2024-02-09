import { Driver, Riders, Rides, Orders, Payments } from '../models';
import express, { Request, Response, json } from 'express';
import mongoose, { Types } from 'mongoose';
import { formatSocketResponse } from '../helpers/common';
import { getUtils } from '..';
import environmentVars from '../constantsVars'

const Razorpay = require('razorpay');
const _ = require('lodash');
const crypto = require('crypto');
const razorpay = new Razorpay({
  key_id: environmentVars.DEV_RAZORPAY_KEY_ID
    ? environmentVars.DEV_RAZORPAY_KEY_ID
    : '',
  key_secret: environmentVars.DEV_RAZORPAY_KEY_SECRET
    ? environmentVars.DEV_RAZORPAY_KEY_SECRET
    : '',
});

async function verifyRazorpayData(body: any, razorpaySignature: string) {
  const secretKey: any = environmentVars.DEV_RAZORPAY_KEY_SECRET;
  const hmac = crypto.createHmac('sha256', secretKey);
  hmac.update(JSON.stringify(body));
  const digest = hmac.digest('hex');
  return digest !== razorpaySignature ? false : true;
}

export async function createOrder(req: Request, res: Response) {
  let session;
  try {
    // console.log('createOrder body', req.body);
    let body = {
      user_id: req.body.user_id,
      mobileNumber: req.body.mobileNumber,
    };
    session = await Payments.startSession();
    session.startTransaction();
    const resp1: any = await Orders.create([body], { session });
    const options: any = {
      amount: req.body.amount,
      currency: 'INR',
      receipt: resp1[0]._id, //any unique id
      notes: {
        rideId: req.body.rideId,
      },
    };
    const response = await razorpay.orders.create(options);
    const resp = await Orders.findByIdAndUpdate(
      resp1[0]._id,
      { order_id: response.id, ...response },
      { new: true, session },
    );
    // console.log('Order Created', resp);
    await session.commitTransaction();
    return res
      .status(200)
      .send({ message: 'Order created successfully', data: resp });
  } catch (error) {
    if (session) {
      await session?.abortTransaction();
    }
    console.log('error', error);
    res.json({ status: 'failed' });
  } finally {
    if (session) {
      await session.endSession();
    }
  }
}

export async function razorPayCallback(req: Request, res: Response, io: any) {
  let session;
  try {
    console.log(
      'razorPayCallback======>',
      req.body?.event,
      ' ',
      req.body?.payload?.payment?.entity?.id,
    );
    const rideId = req.body.payload.payment.entity?.notes?.rideId;
    const event_id = req.headers['x-razorpay-event-id'];
    const check = await Payments.find({ event_id });
    if (check?.length > 0) {
      throw new Error('Event/Event Id Already Received');
    }
    const receivedSignature: any = req.headers['x-razorpay-signature'];
    const valid = await verifyRazorpayData(req.body, receivedSignature);
    if (!valid) {
      throw new Error('Invalid Hash');
    }
    const order_id = req.body.payload.payment.entity.order_id;
    session = await mongoose.startSession();
    session.startTransaction();
    const status = req.body.payload.payment.entity.status; //The order continues to be in the paid state even if the payment associated with the order is refunded.
    console.log('razorPayCallback status', status);
    // Todo: In case of payment failure, do we need to update order status to paid or failed
    let response: any;
    if (status == 'refunded') {
      response = await Orders.findOneAndUpdate(
        { order_id },
        {
          status: status,
          // razorpay_payment_id: req.body.payload.payment.entity.id,
          $addToSet: {
            razorpay_payment_id: req.body.payload.payment.entity.id,
          },
        },
        { session },
      );
    } else if (status == 'captured') {
      response = await Orders.findOneAndUpdate(
        { order_id },
        {
          status: 'paid',
          // razorpay_payment_id: req.body.payload.payment.entity.id,
          $addToSet: {
            razorpay_payment_id: req.body.payload.payment.entity.id,
          },
        },
        { session },
      );
      const updatedRide: any = await Rides.findOneAndUpdate(
        {
          _id: new Types.ObjectId(rideId),
          status: { $in: ['pending-payment', 'payment-failed'] },
        },
        {
          status: 'completed',
        },
        { session: session, new: true },
      ).lean();
      const updateDriver = await Driver.updateOne(
        { _id: updatedRide.driverId, rideStatus: 'on-ride' },
        {
          rideStatus: 'online',
          $inc: { totalRidesCompleted: 1 },
        },
        { session: session, new: true },
      ).lean();
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
      io.to(`${updatedRide._id.toString()}-ride-room`).emit(
        'ride-status',
        formatSocketResponse({
          message: `payment-${status}`,
          data: updatedRide,
        }),
      );
    } else if (status == 'failed') {
      response = await Orders.findOneAndUpdate(
        { order_id },
        {
          status: status,
          // razorpay_payment_id: req.body.payload.payment.entity.id,
          $addToSet: {
            razorpay_payment_id: req.body.payload.payment.entity.id,
          },
        },
        { session },
      );
      let updatedRide: any = await Rides.findOneAndUpdate(
        {
          _id: new Types.ObjectId(rideId),
          status: { $in: ['pending-payment', 'payment-failed'] },
        },
        {
          status: 'payment-failed',
        },
        { session: session, new: true },
      ).lean();
      if (!updatedRide) {
        //! throw error on socket.
        throw new Error('Document not found while completing payment.');
      }
      io.to(`${updatedRide._id.toString()}-ride-room`).emit(
        'ride-status',
        formatSocketResponse({
          message: `payment-${status}`,
          data: updatedRide,
          status:200
        }),
      );
    }
    // if (!response) {
    //   throw new Error('No Payment found with given Id');
    // }
    const record = {
      // order_id,
      user_id: response['user_id'],
      event_id,
      event: req.body.event,
      payload: req.body.payload.payment.entity,
    };
    await Payments.create([record], { session });
    // if (!updateDriver) {
    //   throw new Error('Driver not found while payment-completion.');
    // }

    // Emit a ride-status event to the ride room to indicate completed payment and ride
    await session.commitTransaction();
    res.json({ status: 'ok' });
  } catch (error: any) {
    console.log('error in cllback', error?.message);
    if (session) {
      await session.abortTransaction();
    }
  } finally {
    if (session) {
      await session.endSession();
    }
  }
}

export async function cancelOrder(req: Request, res: Response) {
  try {
    await Orders.findByIdAndUpdate(
      req.body.id,
      { status: 'cancelled', description: req.body.description },
      { upsert: true },
    );
    console.log('Order Cancelled successfully');
    res.send({ status: 'ok' });
  } catch (error) {
    console.log('error', error);
  }
}

export async function getFare(req: Request, res: Response) {
  try {
    const fare: any = getUtils();
    const body = req.body;
    const distance = body.distance;
    const baseFare = fare.baseFare;
    if (!fare || !fare.baseFare) {
      throw new Error('Fare information or baseFare is missing.');
    }
    if (!distance) {
      throw new Error('Distance information is missing.');
    }
    let estimatedFare = Number(distance) * 0.001 * 10 + baseFare; // Base-Fare: Rs 20 per Km. Again updated on driver-end if driver had 'waitingTime' while waiting for rider at pickup, to calculate Total-Fare ('value' is in metre, so multiplied by 0.001).

    const hours = new Date().getHours();
    const isDayTime = hours > 6 && hours < 20;
    if (!isDayTime) {
      estimatedFare = estimatedFare + estimatedFare / 2; // Night-Time Fare is "1.5x".
    }
    estimatedFare = +estimatedFare.toFixed(2); // Round to Two-Decimal Places & convert to number using "+".
    estimatedFare = Math.round(estimatedFare);
    return res.status(200).send({
      message: 'Fair calculated successfully.',
      data: { estimatedFare },
    });
  } catch (err: any) {
    console.log('Fair error: ', err);
    res.status(400).send({ error: err.message });
  }
}
