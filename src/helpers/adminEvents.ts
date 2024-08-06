import { Server, Socket } from 'socket.io';
import { formatSocketResponse } from './common';

const adminSocket: Record<string, Socket> = {};

const getAdminSocket = (email: string): Socket => {
  return adminSocket[email];
};

const getAllAdminSocket = () => {
  return { ...adminSocket };
};

const setDriverSocket = (email: string, socket: Socket): Socket => {
  adminSocket[email] = socket;
  return socket;
};

const adminSocketConnected = async (
  socket: Socket,
  email: string,
  io: Server,
) => {
  try {
    adminSocket[email] = socket;
  } catch (err: any) {
    socket.emit(
      'error',
      formatSocketResponse({
        message: err.message,
      }),
    );
  }
};

// Exporting functions and the event listener for reuse
export default adminSocketConnected;
export { getAllAdminSocket, getAdminSocket, setDriverSocket };
