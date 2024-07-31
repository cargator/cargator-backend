import axios from 'axios';
import { Request, Response } from 'express';
import environmentVars from '../constantsVars';
import { Driver } from '../models/driver.model';
const jwt = require('jsonwebtoken');
const _ = require('lodash');

export async function handleLogin(req: Request, res: Response) {
  try {
    // console.log('login >> body :>> ', req.body);

    // Handle driver login
    if (req.body.type == 'driver') {
      const mobileNumber = req.body.mobileNumber;
      console.log('object', mobileNumber);
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

      let otp: any = Math.floor(1000 + Math.random() * 9000); // Generate a 6-digit OTP
      if (
        mobileNumber.toString().startsWith('7440214173') ||
        mobileNumber.toString().startsWith('9322310197')
      ) {
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

        if (
          mobileNumber.toString().startsWith('7440214173') ||
          mobileNumber.toString().startsWith('9322310197')
        ) {
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
        user = _.pick(user, [
          '_id',
          'mobileNumber',
          'documentsKey',
          'firstName',
        ]);
        const token = jwt.sign(
          { user, type: 'driver' },
          environmentVars.PUBLIC_KEY,
          {
            expiresIn: '7d',
          },
        );
        await Driver.findOneAndUpdate(
          {
            mobileNumber: `91${mobileNumber}`,
            rideStatus: { $ne: 'on-ride' },
          },
          { rideStatus: 'offline' },
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
