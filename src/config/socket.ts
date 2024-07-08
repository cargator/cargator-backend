// socket.ts

import { Server, Socket } from 'socket.io';
import { instrument } from '@socket.io/admin-ui';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
import driverSocketConnected from '../helpers/driverEvents';
import environmentVars from '../constantsVars';
import { formatSocketResponse } from '../helpers/common';
import { addDriversToRoom, sendOrderToDriverRoom } from '../helpers/orderEvents';
import { decodeToken } from '../main/auth';

// Redis clients for pub/sub
const pubClient = createClient({
    url: environmentVars.REDIS_URL || 'redis://default:Titandevil@12@redis-19288.c212.ap-south-1-1.ec2.cloud.redislabs.com:19288',
});
const subClient = pubClient.duplicate();

// Initialize Socket.IO server
export const initializeSocketServer = async (server: any) => {
    const io = new Server(server, {
        transports: ['websocket'],
        cors: {
            credentials: true,
            origin: '*',
        },
        // maxHttpBufferSize: 1e9,
    });

    // Instrumentation for Socket.IO admin UI
    instrument(io, { auth: false, mode: 'development' });

    // Handle Redis client events
    pubClient.on('ready', () => {
        console.log('Publisher connected to Redis and ready to use');
    });
    subClient.on('ready', () => {
        console.log('Subscriber connected to Redis and ready to use');
    });

    // Connect Redis clients
    await Promise.all([pubClient.connect(), subClient.connect()]);

    // Set Redis adapter for Socket.IO
    io.adapter(createAdapter(pubClient, subClient));
    console.log('Connected to Redis');

    // Handle Socket.IO connections
    io.on('connection', async (socket: Socket) => {
        try {
            const token = socket.handshake.query.token as string;
            const data: any = decodeToken(token);

            if (!data) {
                throw new Error('Invalid token');
            }

            const userId = data.user._id;
            const type = data.type;

            if (!userId || !type) {
                throw new Error('Missing userId or type');
            }

            // Handle specific socket connection logic (e.g., for drivers)
            await driverSocketConnected(socket, userId, io);

            // Handle socket disconnection
            socket.on('disconnect', () => {
                console.log('Socket disconnected:', socket.id);
            });
        } catch (error: any) {
            console.error('Socket connection error:', error.message);
            socket.emit('error', formatSocketResponse({ message: error.message }));
            socket.disconnect();
        }
    });

    // Subscribe to Redis channels for handling events
    subClient.subscribe('join-drivers-to-orders', (channel, message) => {
        sendOrderToDriverRoom(message);
    });

    subClient.subscribe('join-drivers-to-rides', (channel, message) => {
        addDriversToRoom(message);
    });

    return io;
};

// Function to publish messages to Redis channels
export const publishMessage = (channel: string, message: string) => {
    pubClient.publish(channel, message);
};
