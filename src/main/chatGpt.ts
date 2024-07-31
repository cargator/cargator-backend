import { Request, Response } from 'express';
import axios from 'axios';
import environmentVars from '../constantsVars';
import { getAppFLow } from './app';
import { FlowTypeEnum } from '../shared/enums/status.enum';
import { PlaceOrder } from '../models/placeOrder.model';

const apiUrl: any = environmentVars.OPEN_AI_API_URL;

export async function chatGptApi(req: Request, res: Response) {
  const { mode, input } = req.body;

  try {
    if (!mode || !input) {
      throw new Error('Both mode and input are required.');
    }

    const flowType = await getAppFLow();

    let startDate = new Date();
    let endDate = new Date();

    switch (mode) {
      case 'today':
        startDate.setHours(0, 0, 0, 0);
        endDate.setDate(startDate.getDate() + 1);
        break;
      case 'lastWeek':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case 'lastMonth':
        startDate.setDate(startDate.getDate() - 30);
        break;
      default:
        throw new Error('Invalid mode.');
    }

    let data;
    switch (flowType?.applicationFLow) {


      case FlowTypeEnum.PETPOOJA:
        data = await PlaceOrder.find({
          createdAt: { $gte: startDate, $lt: endDate },
        })
          .sort({ createdAt: -1 })
          .select('-_id status fare paymentMode cancelBy.reason');
        break;

      default:
        throw new Error('Invalid flow type.');
    }

    if (data.length === 0) {
      res.status(200).send({
        success: false,
        message: `No data found for ${flowType} in the specified period.`,
      });
      return;
    }

    const requestData = {
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'user',
          content: `${flowType} information: ${JSON.stringify(data)}`,
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
        Authorization: `Bearer ${environmentVars.OPEN_AI_API_KEY}`,
      },
    });

    const responseData = response.data.choices[0].message;
    console.log('chatgpt response>>>>>>', responseData['content']);
    res.status(200).send({
      message: 'Fetched chat-gpt data successfully',
      data: responseData['content'],
    });
  } catch (error: any) {
    console.log('Error fetching data:', error);
    res.status(401).send({ message: error?.message });
  }
}
