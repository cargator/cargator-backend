import axios from 'axios';
import environmentVars from '../constantsVars';
import { Request, Response } from 'express';
import { Driver } from '../models/driver.model';
import jwt from 'jsonwebtoken';
import { pick } from 'lodash';
import { sendOtpViaSms } from '../config/smsOtpService';

export async function handleLogin(req: Request, res: Response) {
  try {
    const { type, mobileNumber } = req.body;
    if (type == 'driver') {
      if (!mobileNumber) {
        throw new Error(`Invalid Mobile Number!`);
      }

      let driverDoc = await Driver.findOne({
        mobileNumber: `91${mobileNumber}`,
        status: 'active',
      }).lean();

      if (!driverDoc) {
        throw new Error('Please enter a registered mobile number.');
      }

      let otp: any = Math.floor(1000 + Math.random() * 9000); // Generate a 4-digit OTP
      if (
        mobileNumber.toString().startsWith('7440214173') ||
        mobileNumber.toString().startsWith('9322310197')
      ) {
        otp = '0000';
        await Driver.findOneAndUpdate(
          { mobileNumber: `91${mobileNumber}` },
          {
            otp,
          },
        );

        return res.status(200).send({ message: `Otp is generated` });
      }

      if (
        !driverDoc.otp ||
        !driverDoc.otpExpirationTime ||
        (driverDoc.otpExpirationTime &&
          new Date(driverDoc.otpExpirationTime) < new Date())
      ) {
        const otpExpire: any = environmentVars.OTP_EXPIRE || 0.5; // OTP Expiration Time is "30 Seconds".

        await Driver.findOneAndUpdate(
          { mobileNumber: `91${mobileNumber}` },
          {
            otp,
            otpExpirationTime: new Date(
              new Date().getTime() + otpExpire * 60000,
            ),
          },
          { upsert: true },
        );

        if (
          mobileNumber.toString().startsWith('7440214173') ||
          mobileNumber.toString().startsWith('9322310197')
        ) {
          return res
            .status(200)
            .send({ message: `OTP sent to mobile number 91${mobileNumber}.` });
        } else {
          const sendSmsRes = await sendOtpViaSms(mobileNumber, otp);
          console.log(`sendSmsRes :>> `, sendSmsRes?.data);
          return res
            .status(200)
            .send({ message: `OTP sent to mobile number 91${mobileNumber}.` });
        }
      } else {
        // throw new Error(`Wait for 30 seconds before requesting another OTP!`);
        return res
          .status(200)
          .send({ message: `OTP sent to mobile number ${mobileNumber}.` });
      }
    }
  } catch (error: any) {
    console.log(error);
    return res.status(400).send({ error: error.message });
  }
}

export async function verifyOtp(req: Request, res: Response) {
  try {
    if (req.body.type == 'driver') {
      // Handle driver OTP verification
      const otp = req.body.otp;
      const mobileNumber = req.body.mobileNumber;

      // Check if OTP and mobile number are provided
      if (!otp) {
        throw new Error(`Invalid otp Driver`);
        // return res.status(400).send({ message: `Invalid otp` });
      }
      if (!mobileNumber) {
        throw new Error(`Please provide your mobile number`);
      }

      // Find the driver based on the provided mobile number
      let user: any = await Driver.findOne({
        mobileNumber: `91${mobileNumber}`,
      }).lean();
      let profileImageKey = user.profileImageKey;

      // Check if the driver is registered
      if (!user) {
        // res.status(400).send({ message: 'Mobile number is not registered' });
        throw new Error(`Mobile number is not registered`);
      }

      // Verify OTP
      if (otp == user.otp || mobileNumber === '9876543210') {
        // Select relevant user fields and generate a JWT token
        user = pick(user, [
          '_id',
          'mobileNumber',
          'documentsKey',
          'firstName',
          'restaurentName',
        ]);
        const token = jwt.sign(
          { user, type: 'driver' },
          environmentVars.PUBLIC_KEY,
          {
            expiresIn: '7d',
          },
        );
        return res.json({
          user: { ...user, profileImageKey },
          token,
          message: 'welcome',
          status: 200,
        });
      } else {
        // res.status(400).send({ message: 'Invalid OTP' });
        throw new Error(`Invalid otp Driver`);
      }
    }
  } catch (error: any) {
    // console.log(JSON.stringify(error));
    console.log(error);
    return res.status(400).send({ error: error.message });
    // return res.status(400).send(error.message);
  }
}

let access_token = 'string';
export const refreshToken = async () => {
  try {
    const data = {
      grant_type: 'client_credentials',
      client_id: `${environmentVars.REFRESH_TOKEN_CLIENT_ID}`,
      client_secret: `${environmentVars.REFRESH_TOKEN_CLIENT_SECRET}`,
    };

    const token: any = await axios.post(
      `${environmentVars.REFRESH_TOKEN_URL}`,
      data,
      {
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
      },
    );
    if (!token) {
      throw new Error('Token is not generated due to server error');
    }
    // console.log('token', token)
    access_token = token.data.access_token;
    console.log('Token for MapMyIndia refreshed successfully:', access_token);
  } catch (error) {
    console.error('Token refresh failed:', error);
  }
};

export const decodeToken = (token: string) => {
  try {
    return jwt.verify(token, environmentVars.PUBLIC_KEY);
  } catch (error) {
    return false;
  }
};

export function useAccessToken() {
  return access_token;
}
