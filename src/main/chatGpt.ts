import { Request, Response } from 'express';
import axios from 'axios';
import { Rides } from '../models';
const apiUrl: any = process.env.OPEN_AI_API_URL;

export async function chatGptApi(req: Request, res: Response) {
  const mode = req.body.mode;
  const input = req.body.input;
  try {
    if (!mode && !input) {
      throw new Error('Both text and input are required.');
    }

    if (mode == 'today') {
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Set the time to midnight for the current date

      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1); // Set it to the beginning of tomorrow
      // console.log('today', today);
      // console.log('tomorrow', tomorrow);

      const ridesCreatedToday = await Rides.find({
        createdAt: {
          $gte: today, // Greater than or equal to the beginning of today
          $lt: tomorrow, // Less than the beginning of tomorrow
        },
      })
        .sort({ createdAt: -1 })
        .select('-_id status fare paymentMode cancelBy.reason'); // Sort in descending order by createdAt;
      // console.log(`rides information is  ${ridesCreatedToday}`)
      if (ridesCreatedToday.length === 0) {
        // Handle the case where there are no matching records
        // console.log("No matching records found.");
        res
          .status(200)
          .send({ success: false, message: 'I have no data for today.' });
        return;
      }
      const requestData = {
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'user',
            content: `rides information is ${ridesCreatedToday}`,
          },
          {
            role: 'user',
            content: `${input}`,
          },
        ],
      };
      const response = await axios.post(apiUrl, requestData, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.OPEN_AI_API_KEY}`,
        },
      });

      const responseData = response.data.choices[0].message;
      // Perform data analysis on responseData
      // console.log(responseData['content']);
      res.status(200).send({
        message: 'Fetched chat-gpt data successfully',
        data: responseData['content'],
      });

      // Process the rides created today
      //console.log(
      //  'Rides created today (descending order):',
      // ridesCreatedToday.length,
      // );
    } else if(mode == 'lastWeek') {
        const today = new Date();

        // Calculate the date one week ago
        const oneWeekAgo = new Date(today);
        oneWeekAgo.setDate(today.getDate() - 7);

        const ridesCreatedLastWeek = await Rides.find({
          createdAt: {
            $gte: oneWeekAgo, // Greater than or equal to one week ago
            $lt: today, // Less than the current date
          },
        })
          .sort({ createdAt: -1 })
          .select('-_id status fare paymentMode cancelBy.reason'); // Sort in descending order by createdAt;
        //console.log(
        // `ridesCreatedLastWeek information is  ${ridesCreatedLastWeek}`,
        //);
        if (ridesCreatedLastWeek.length === 0) {
          // Handle the case where there are no matching records
          console.log('No matching records found.');
          res.status(200).send({
            success: false,
            message: 'No Rides is created in last week.',
          });
          return;
        }
        const requestData = {
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'user',
              content: `ridesCreatedLastWeek information is ${ridesCreatedLastWeek}`,
            },
            {
              role: 'user',
              content: `${input}`,
            },
          ],
        };
        const response = await axios.post(apiUrl, requestData, {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.OPEN_AI_API_KEY}`,
          },
        });

        const responseData = response.data.choices[0].message;
        // Perform data analysis on responseData
        //console.log(responseData['content']);
        res.status(200).send({
          message: 'Fetched chat-gpt data successfully',
          data: responseData['content'],
        });
        // Process the rides created today
        //console.log(
        // 'Rides created today (descending order):',
        // ridesCreatedLastWeek.length,
        //);
      } else {
      if (mode == 'lastMonth') {
        const today = new Date();

        // Calculate the date one week ago
        const oneMonthAgo = new Date(today);
        oneMonthAgo.setDate(today.getDate() - 30);

        const ridesCreatedLastMonth = await Rides.find({
          createdAt: {
            $gte: oneMonthAgo, // Greater than or equal to one Month ago
            $lt: today, // Less than the current date
          },
        })
          .sort({ createdAt: -1 })
          .select('-_id status fare paymentMode cancelBy.reason'); // Sort in descending order by createdAt;
        //console.log(
        // `ridesCreatedLastWeek information is  ${ridesCreatedLastWeek}`,
        //);
        if (ridesCreatedLastMonth.length === 0) {
          // Handle the case where there are no matching records
          console.log('No matching records found.');
          res.status(200).send({
            success: false,
            message: 'No Rides is created in last Month.',
          });
          return;
        }
        const requestData = {
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'user',
              content: `ridesCreatedLastMonth information is ${ridesCreatedLastMonth}`,
            },
            {
              role: 'user',
              content: `${input}`,
            },
          ],
        };
        const response = await axios.post(apiUrl, requestData, {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.OPEN_AI_API_KEY}`,
          },
        });

        const responseData = response.data.choices[0].message;
        // Perform data analysis on responseData
        //console.log(responseData['content']);
        res.status(200).send({
          message: 'Fetched chat-gpt data successfully',
          data: responseData['content'],
        });
        // Process the rides created today
        //console.log(
        // 'Rides created today (descending order):',
        // ridesCreatedLastWeek.length,
        //);
      } else {
        throw new Error('Please input correct mode.');
      }
    }
  } catch (error: any) {
    console.log('Error fetching rides:', error);
    return res.status(401).send({ message: error?.message });
  }
}
