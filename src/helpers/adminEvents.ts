import { Types } from 'mongoose';
import { Server, Socket } from 'socket.io';
import { formatSocketResponse } from './common';
// const { utilsData } = require('../index.ts');

const adminSocket: Record<string, Socket> = {};

// Function to get the socket of a driver based on their userId
const getAdminSocket = (email: string): Socket => {
  return adminSocket[email];
};

const getAllSocket = () => {
  return { ...adminSocket };
};

// Function to set the socket of a driver based on their userId
const setDriverSocket = (email: string, socket: Socket): Socket => {
    adminSocket[email] = socket;
  return socket;
};

// Function to handle the event when a driver's socket is connected
const adminSocketConnected = async (
  socket: Socket,
  email: string,
  io: Server,
) => {
    console.log("hiiiiiiiiiii");
    
  let _email = new Types.ObjectId(email);
  try {
    // Set the driver's socket in the driversSocket object
    console.log('Socket connected successfully!', email);
    adminSocket[email] = socket;
  } catch (err: any) {
    socket.emit(
      'error',
      formatSocketResponse({
        message: err.message,
      }),
    );
  }
}

// Exporting functions and the event listener for reuse
export default adminSocketConnected;
export { getAllSocket, getAdminSocket, setDriverSocket };
