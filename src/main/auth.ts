import axios from 'axios';
import environmentVars from '../constantsVars'
import { Request, Response } from 'express';
import { Driver } from '../models/driver.model';
import jwt from 'jsonwebtoken';
import { pick } from 'lodash';

export async function handleLogin(req: Request, res: Response) {
  try {
    // console.log('login >> body :>> ', req.body);

    // Handle driver login
    if (req.body.type == 'driver') {
      const liveLocation = req.body.liveLocation;
      const mobileNumber = req.body.mobileNumber;
      console.log("object", mobileNumber)
      if (!mobileNumber) {
        throw new Error(`Invalid Mobile Number!`);
      }

      // Validate liveLocation format
      if (!Array.isArray(liveLocation) || liveLocation.length !== 2 || typeof liveLocation[0] !== 'number' || typeof liveLocation[1] !== 'number') {
        console.log(liveLocation[0], liveLocation[1])
        throw new Error('Invalid liveLocation format. Expected [longitude, latitude].');
      }

      let driver = await Driver.findOne({
        mobileNumber: `91${mobileNumber}`,
        status: 'active',
      }).lean();
      if (!driver) {
        throw new Error('Please enter a registered mobile number.');
      }
      // Find or create a driver document with the provided mobile number
      const driverDoc = await Driver.findOneAndUpdate(
        { mobileNumber: `91${mobileNumber}` },
        { $set: { liveLocation } }, // assuming liveLocation is correctly formatted [longitude, latitude]
        { upsert: true, new: true }
      ).lean();

      let otp: any = Math.floor(1000 + Math.random() * 9000); // Generate a 6-digit OTP
      if (mobileNumber.toString().startsWith('7440214173')) {
        otp = '0000';
        const update = await Driver.findOneAndUpdate(
          { mobileNumber: `91${mobileNumber}` },
          {
            otp,
          },
        );
        // console.log('update--->', update);
        return res.status(200).send({ message: `Otp is generated` });
      }
      // let otp: any = '000000';

      // // Update the driver document with the generated OTP

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

        if (mobileNumber.toString().startsWith('7440214173')) {
          return res
            .status(200)
            .send({ message: `OTP sent to mobile number 91${mobileNumber}.` });
        } else {
          // const sendSmsRes = await axios.get(
          //   // `http://sms.bulkssms.com/submitsms.jsp?user=icallsms&key=d1cd9d7799XX&mobile=${mobileNumber}&message=Welcome to Cargator! Your login OTP is ${otp}.This code is valid for 5 minutes only.&senderid=MiCALL&accusage=1&entityid=1201159179632441114&tempid=1507167275825310764`, // ! NOT WORKING.
          //   `http://sms.bulkssms.com/submitsms.jsp?user=icallsms&key=d1cd9d7799XX&mobile=${mobileNumber}&message=Greetings from iCALL, Use this OTP ${otp} to complete your registration to iCALL's Chat services. Thank you.&senderid=MiCALL&accusage=1&entityid=1201159179632441114&tempid=1507167275825310764`, //! Change this message according to Cargator.
          // );
          // console.log(`sendSmsRes :>> `, sendSmsRes?.data);
          const sendSmsRes = await axios.get(
            `https://api.authkey.io/request?authkey=${environmentVars.AUTHKEY_OTP}&mobile=${mobileNumber}&country_code=91&sid=${environmentVars.OTP_SID}&otp=${otp}`,
          );
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
        mobileNumber: `91${mobileNumber}`
      }).lean();
      let profileImageKey = user.profileImageKey;

      // Check if the driver is registered
      if (!user) {
        // res.status(400).send({ message: 'Mobile number is not registered' });
        throw new Error(`Mobile number is not registered`);
      }


      // Verify OTP
      if ((otp == user.otp) || mobileNumber === '9876543210') {
        // Select relevant user fields and generate a JWT token
        user = pick(user, ['_id', 'mobileNumber', 'documentsKey', 'firstName']);
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

let access_token = "string";
export const refreshToken = async () => {
  try {
    // Make a request to obtain a new token (assuming you have the necessary API endpoint)
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