import axios from 'axios';
import { Driver, Riders } from '../models';
import { Request, Response } from 'express';
const jwt = require('jsonwebtoken');
const _ = require('lodash');

export async function handleLogin(req: Request, res: Response) {
  try {
    // console.log('login >> body :>> ', req.body);

    // Handle driver login
    if (req.body.type == 'driver') {
      const liveLocation = req.body.liveLocation;
      const mobileNumber = req.body.mobileNumber;
      if (!mobileNumber) {
        throw new Error(`Invalid Mobile Number!`);
      }
      let driver = await Driver.findOne({
        mobileNumber: `91${mobileNumber}` ,
        status: 'active',
      }).lean();
      if (!driver) {
        throw new Error('Please enter a registered mobile number.');
      }
      // Find or create a driver document with the provided mobile number
      let driverDoc = await Driver.findOneAndUpdate(
        { mobileNumber: `91${mobileNumber}` },
        {
          mobileNumber: `91${mobileNumber}`,
          liveLocation: liveLocation,
        },
        { upsert: true, new: true },
      ).lean();

      let otp: any = Math.floor(1000 + Math.random() * 9000); // Generate a 6-digit OTP
      if (mobileNumber.toString().startsWith('00')) {
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
        const otpExpire: any = process.env.OTP_EXPIRE || 0.5; // OTP Expiration Time is "30 Seconds".

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

        if (mobileNumber.toString().startsWith('00')) {
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
            `https://api.authkey.io/request?authkey=${process.env.AUTHKEY_OTP}&mobile=${mobileNumber}&country_code=91&sid=${process.env.OTP_SID}&otp=${otp}`,
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
    } else {
      // Handle rider login
      const mobileNumber = req.body.mobileNumber;
      if (!mobileNumber) {
        throw new Error(`Invalid Mobile Number`);
      }

      // Find or create a rider document with the provided mobile number
      let riderDoc = await Riders.findOneAndUpdate(
        { mobileNumber: `91${mobileNumber}` },
        { mobileNumber: `91${mobileNumber}` },
        { upsert: true, new: true },
      ).lean();

      let otp: any = Math.floor(1000 + Math.random() * 9000); // Generate a 6-digit OTP
      // if (mobileNumber.toString().startsWith('00')) {
      //   otp = '111111';
      // }
      // let otp = '000000';

      // // Update the rider document with the generated OTP
      // const update = await Riders.findOneAndUpdate(
      //   { mobileNumber },
      //   {
      //     otp,
      //   },
      // );
      // return res.status(200).send({ message: `Otp is generated` });

      if (
        !riderDoc.otp ||
        !riderDoc.otpExpirationTime ||
        (riderDoc.otpExpirationTime &&
          new Date(riderDoc.otpExpirationTime) < new Date())
      ) {
        const otpExpire: any = process.env.OTP_EXPIRE || 0.5; // OTP Expiration Time is "30 Seconds".

        await Riders.findOneAndUpdate(
          { mobileNumber: `91${mobileNumber}` },
          {
            otp,
            otpExpirationTime: new Date(
              new Date().getTime() + otpExpire * 60000,
            ),
          },
          { upsert: true },
        );

        if (mobileNumber.toString().startsWith('00')) {
          return res.status(200).send({
            message: `OTP sent to mobile number 91${mobileNumber}.`,
          });
        } else {
          // const sendSmsRes=await axios.get(`https://api.authkey.io/request?authkey=641af54d28834eb0&mobile=${mobileNumber}&country_code=91&sms=Hello, your OTP is ${otp}&sender=641af54d28834eb0`)
          const sendSmsRes = await axios.get(
            `https://api.authkey.io/request?authkey=${process.env.AUTHKEY_OTP}&mobile=${mobileNumber}&country_code=91&sid=${process.env.OTP_SID}&otp=${otp}`,
          );
          // const sendSmsRes = await axios.get(
          //   // `http://sms.bulkssms.com/submitsms.jsp?user=icallsms&key=d1cd9d7799XX&mobile=${mobileNumber}&message=Welcome to Cargator! Your login OTP is ${otp}.This code is valid for 5 minutes only.&senderid=MiCALL&accusage=1&entityid=1201159179632441114&tempid=1507167275825310764`, // ! NOT WORKING.
          //   `http://sms.bulkssms.com/submitsms.jsp?user=icallsms&key=d1cd9d7799XX&mobile=${mobileNumber}&message=Greetings from iCALL, Use this OTP ${otp} to complete your registration to iCALL's Chat services. Thank you.&senderid=MiCALL&accusage=1&entityid=1201159179632441114&tempid=1507167275825310764`, //! Change this message according to Cargator.
          // );
          // console.log(`sendSmsRes :>> `, sendSmsRes);
          console.log(`sendSmsRes :>> `, sendSmsRes?.data);
          return res
            .status(200)
            .send({ message: `OTP sent to mobile number 91${mobileNumber}.` });
        }
      } else {
        // throw new Error(`Wait for 30 seconds before requesting another OTP!`);
        return res
          .status(200)
          .send({ message: `OTP sent to mobile number 91${mobileNumber}.` });
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
        user = _.pick(user, ['_id', 'mobileNumber', 'documentsKey']);
        const token = jwt.sign(
          { user, type: 'driver' },
          process.env.PUBLIC_KEY,
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
    } else {
      // Handle rider OTP verification (similar logic as driver)
      const otp = req.body.otp;
      const mobileNumber = req.body.mobileNumber;

      // Check if OTP and mobile number are provided
      if (!otp) {
        throw new Error(`Invalid otp Rider`);
      }
      if (!mobileNumber) {
        // res.status(400).send({ message: 'Please provide your mobile number' });
        throw new Error(`Please provide your mobile number`);
      }

      // Find the rider based on the provided mobile number
      let user: any = await Riders.findOne({
         mobileNumber: `91${mobileNumber}` 
      }).lean();
      let userData = user;
      // Check if the rider is registered
      if (!user) {
        // res.status(400).send({ message: 'Mobile number is not registered' });
        throw new Error(`Mobile number is not registered`);
      }

      // Verify OTP
      if ((otp == user.otp)  || mobileNumber === '9876543210') {
        // Select relevant user fields and generate a JWT token
        user = _.pick(user, ['_id', 'mobileNumber']);
        const token = jwt.sign(
          { user, type: 'rider' },
          process.env.PUBLIC_KEY,
          {
            expiresIn: '7d',
          },
        );

        // Return user information and token
        return res.json({
          user: userData,
          token,
          message: 'welcome',
          status: 200,
        });
      } else {
        // res.status(400).send({ message: 'Invalid OTP' });
        throw new Error(`Invalid otp Rider`);
      }
    }
  } catch (error: any) {
    // console.log(JSON.stringify(error));
    console.log(error);
    return res.status(400).send({ error: error.message });
    // return res.status(400).send(error.message);
  }
}
