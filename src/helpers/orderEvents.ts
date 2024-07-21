import { publishMessage } from '../config/socket';
import { PlaceOrder } from '../models';
import { Driver } from '../models/driver.model';
import { OrderStatusEnum } from '../shared/enums/status.enum';
import { formatSocketResponse } from './common';
import { getDriverSocket } from './driverEvents';

export const sendOrderToDriverRoom: any = (data: any) => {
  try {
    const { newOrder, drivers } = JSON.parse(data);
    drivers.forEach((driver: any) => {
      let tempDriverId = driver._id.toString();
      const driversSocket = getDriverSocket(tempDriverId);
      if (driversSocket) {
        driversSocket.join(`${newOrder._id.toString()}-ride-room-pre`);
        driversSocket.emit('order-request', [newOrder]);
      }
    });
    console.log('all drivers added to room');
  } catch (error: any) {
    console.log('error :', error);
  }
};

export function addDriversToRoom(data: any) {
  try {
    const { ride, drivers } = JSON.parse(data);
    drivers.forEach((driver: any) => {
      let tempDriverId = driver._id.toString();
      const driversSocket = getDriverSocket(tempDriverId);
      if (driversSocket) {
        driversSocket.join(`${ride._id.toString()}-ride-room-pre`);
        driversSocket.emit('ride-request', formatSocketResponse([ride]));
      }
    });
    console.log('all drivers added to room');
  } catch (error: any) {
    throw new Error(error);
  }
}

export const checkOrders = async (newOrder?: any) => {
  try {
    const endDate = new Date();
    endDate.setMinutes(endDate.getMinutes() - 10);

    if (!newOrder) {
      const orders = await PlaceOrder.find({
        createdAt: { $gte: endDate },
        status: OrderStatusEnum.ORDER_ACCEPTED,
      });

      for (const order of orders) {
        const availableDrivers = await Driver.find({
          rideStatus: 'online',
          status: 'active',
        })
          .limit(20)
          .lean();

        const data = { newOrder: order, drivers: availableDrivers };

        publishMessage('join-drivers-to-orders', formatSocketResponse(data));
      }
    } else {
      const availableDrivers = await Driver.find({
        rideStatus: 'online',
        status: 'active',
      })
        .limit(20)
        .lean();

      const data = { newOrder, drivers: availableDrivers };

      publishMessage('join-drivers-to-orders', formatSocketResponse(data));
    }
  } catch (error: any) {
    console.error('Error while checking orders:', error.message);
  }
};
