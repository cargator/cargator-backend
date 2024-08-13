import { config } from 'dotenv';
config();

const environmentVars = {
  PORT: 3001,
  MONGO_URL: process.env.MONGO_URL_SUKAM,
  GOOGLE_API_KEY: process.env.GOOGLE_API_KEY,
  OLA_MAPS_API_KEY: process.env.OLA_MAPS_API_KEY,
  REDIS_URL: process.env.REDIS_URL_SUKAM || "redis-10131.c305.ap-south-1-1.ec2.redns.redis-cloud.com",
  REDIS_PASSWORD: process.env.REDIS_PASSWORD,
  NODE_ENV: process.env.NODE_ENV,
  PUBLIC_KEY: process.env.PUBLIC_KEY,
  DEV_RAZORPAY_KEY_ID: process.env.DEV_RAZORPAY_KEY_ID,
  DEV_RAZORPAY_KEY_SECRET: process.env.DEV_RAZORPAY_KEY_SECRET,
  OPEN_AI_API_KEY: process.env.OPEN_AI_API_KEY,
  OPEN_AI_API_URL: process.env.OPEN_AI_API_URL,
  OTP_EXPIRE: process.env.OTP_EXPIRE,
  AWS_REGION: process.env.AWS_REGION,
  AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
  MAP_MY_INDIA: process.env.MAP_MY_INDIA,
  REFRESH_TOKEN_URL: process.env.REFRESH_TOKEN_URL,
  REFRESH_TOKEN_CLIENT_ID: process.env.REFRESH_TOKEN_CLIENT_ID,
  REFRESH_TOKEN_CLIENT_SECRET: process.env.REFRESH_TOKEN_CLIENT_SECRET,
  OTP_SID: process.env.OTP_SID,
  WHATSAPP_AUTH_TOKEN: process.env.WHATSAPP_AUTH_TOKEN,
  AUTHKEY_OTP: process.env.AUTHKEY_OTP,
  EMAIL_AUTHKEY: process.env.EMAIL_AUTHKEY,
  PETPUJA_API_KEY: process.env.PETPUJA_API_KEY,
  PETPUJA_SECRET_KEY: process.env.PETPUJA_SECRET_KEY,
  PETPUJA_API_URL: process.env.PETPUJA_API_URL,
  PETPOOJA_ACCESS_TOKEN: process.env.PETPOOJA_ACCESS_TOKEN,
  EMAIL_USER: process.env.EMAIL_USER,
  EMAIL_PASS: process.env.EMAIL_PASS,
  CLIENT_EMAIL: process.env.CLIENT_EMAIL,
  PRIVATE_KEY: process.env.PRIVATE_KEY,
  PROJECT_ID: process.env.PROJECT_ID_SUKAM,
  SENTRY_PRODUCTION: process.env.SENTRY_PRODUCTION,
};

(() => {
  Object.entries(environmentVars).forEach((env: any[]) => {
    if (!env[1] || (env[1] && env[1].toString().trim() === '')) {
      console.log('env -- ', env);
      throw new Error('Please provide proper env variables');
    }
  });
})();
export default environmentVars;
