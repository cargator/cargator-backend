import mongoose from 'mongoose';
import { CountryCode } from '../models';
import { Request, Response } from 'express';

export async function createCountryCode(req: Request, res: Response) {
  let session: any;
  try {
    const { countryCode, countryName } = req.body;

    session = await mongoose.startSession();
    session.startTransaction();

    // Find all CountryCode
    const existingCountryCode = await CountryCode.findOne({
      countryCode: countryCode,
    });

    if (existingCountryCode) {
      // const updatedCountryCode = await CountryCode.updateMany(
      //   { sequenceNo: { $gte: countryCode } },
      //   { $inc: { sequenceNo: 1 } },
      //   { session }
      // );
      res.send({ message: 'CountryCode already exist' });
    }
    // Create the new CountryCode with the specified
    const reponses = await CountryCode.create(
      [
        {
          countryCode: `+${countryCode}`,
          countryName: countryName,
        },
      ],
      { session },
    );

    await session.commitTransaction();

    res.status(200).send({
      message: ' countryCode has been created.',
    });
  } catch (error: any) {
    if (session) {
      await session.abortTransaction();
    }
    res.status(400).json({ success: false, message: error.message });
  } finally {
    if (session) {
      await session.endSession();
    }
  }
}

export async function getCountryCodes(req: Request, res: Response) {
  try {
    const responses = await CountryCode.find();
    return res.status(200).json({
      message: 'Fetched all country code',
      data: responses,
    });
  } catch (error: any) {
    console.log('get country code error: ', error);
    res.status(400).send({ error: error.message });
  }
}

// export async function getCountryCodeOne(req: Request, res:Response){
//     let session: any;
//     try {
//       session = await mongoose.startSession();
//       session.startTransaction();

//       const id = req.params.id;

//       const countrycode = await CountryCode.findById({ _id: id });

//       if (!countrycode) {
//         throw new Error("Error while getting breakpoints");
//       }

//       await session.commitTransaction();
//       res.status(200).send({
//         message: " Vehicle Type deleted Successfully.",
//         data: countrycode,
//       });
//     } catch (error: any) {
//       res.status(400).json({ success: false, message: error.message });
//       if (session) {
//         await session.abortTransaction();
//       }
//       console.log("err :>> ", error);
//     } finally {
//       if (session) {
//         await session.endSession();
//       }
//     }
// }

export async function getCountryCodeMobiles(req: Request, res: Response) {
  try {
    const responses: any = await CountryCode.find(
      {},
      { _id: 0, countryCode: 1 },
    );

    return res.status(200).json({
      message: 'Fetched all country code',
      data: responses,
    });
  } catch (error: any) {
    console.log('get country code error: ', error);
    res.status(400).send({ error: error.message });
  }
}

export async function deleteCountryCode(req: Request, res: Response) {
  let session: any;
  try {
    session = await mongoose.startSession();
    session.startTransaction();

    const id = req.params.id;

    const deleteType = await CountryCode.deleteOne({ _id: id });

    if (!deleteType) {
      throw new Error('Error while deleting vehicleType');
    }

    await session.commitTransaction();
    res.status(200).send({
      message: ' Vehicle Type deleted Successfully.',
      data: deleteType,
    });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
    if (session) {
      await session.abortTransaction();
    }
    console.log('err :>> ', error);
  } finally {
    if (session) {
      await session.endSession();
    }
  }
}
