import mongoose, { ConnectOptions } from 'mongoose';
import constants from '../constantsVars';

const CONNECTION_URL: string = constants.MONGO_URL as string;

const mongoConnect = async () => {
  await mongoose.connect(CONNECTION_URL).catch((err) => {
    console.log('Mongo connection failed ', err.message);
    throw err;
  });
  console.log('mongo connection successfull');
};

export default mongoConnect;
