/**
 * The above code is a TypeScript implementation of handling webhook requests for a WhatsApp chatbot.
 * It includes functions to handle webhook verification, handle webhook post requests, and send
 * interactive and text messages to the user.
 * @param {InteractiveMessageBody} interactiveMessageBody - The `interactiveMessageBody` is an object
 * that contains the following parameters:
 */
import axios from 'axios';
import { Request, Response } from 'express';
import get from 'lodash/get.js';
import dotenv from 'dotenv';
import { Driver, Rides, whatsappChats } from '../models';
import { getUtils } from '..';
dotenv.config();

interface InteractiveMessageBody {
  [key: string]: any;
}

const token = process.env.WHATSAPP_AUTH_TOKEN;

export async function handleWebhookVerification(req: Request, res: Response) {
  console.log(req.query['hub.verify_token']);
  console.log(req.query['hub.challenge']);
  res.send(req.query['hub.challenge']);
}

export async function handleWebhookPost(req: Request, res: Response) {
  try {
    console.log('whatsAppChatBot');
    const interactiveMessageBody: InteractiveMessageBody = {};
    let riderData: InteractiveMessageBody = {};
    const body_param = req.body;
    let typeOfInteractive, idOfInteractive;
    let typeOfMessage = get(
      body_param,
      'entry[0].changes[0].value.messages[0].type',
      undefined,
    );
    const senderNumber = get(
      body_param,
      'entry[0].changes[0].value.messages[0].from',
      undefined,
    );
    const phoneId = get(
      body_param,
      'entry[0].changes[0].value.metadata.phone_number_id',
      undefined,
    );

    if (!typeOfMessage || !senderNumber) return;
    console.log('typeOfMessage ', typeOfMessage);

    if (typeOfMessage == 'interactive') {
      typeOfInteractive = get(
        body_param,
        'entry[0].changes[0].value.messages[0].interactive.type',
        undefined,
      );
      idOfInteractive = get(
        body_param,
        'entry[0].changes[0].value.messages[0].interactive.button_reply.id',
        undefined,
      );
      if (typeOfInteractive == 'button_reply')
        typeOfMessage = 'button_interactive';
      if (
        typeOfInteractive == 'button_reply' &&
        idOfInteractive.startsWith('Yes')
      )
        typeOfMessage = 'board_interactive';
      if (
        typeOfInteractive == 'button_reply' &&
        idOfInteractive.startsWith('No')
      )
        typeOfMessage = 'board_interactive';
      if (
        typeOfInteractive == 'button_reply' &&
        idOfInteractive.startsWith('track_Location')
      )
        typeOfMessage = 'driver_interactive';
    }
  

    interactiveMessageBody['sender'] = senderNumber;
    interactiveMessageBody['phoneId'] = phoneId;

    switch (typeOfMessage) {
      case 'text': {
        const resp3 = await whatsappChats.findOneAndUpdate(
          { mobileNumber: senderNumber },
          { dropLocation: null, pickUpLocation: null , pickAddress:null, dropAddress:null},
          { new: true },
        );

        interactiveMessageBody['title'] =
          'Hello, Thank You for contacting Zenzo. Please share your current/preferred location for an ambulance pickup.';
        interactiveMessageBody['messages'] = [
          {
            type: 'reply',
            reply: {
              id: `sendLoc`,
              title: `Send Location`,
          }
        }
        ];
        await sendInteractiveMessagesButtons(interactiveMessageBody);
        break;
      }

      case 'location': {
        const resp3 = await whatsappChats.findOne({
          mobileNumber: senderNumber,
        });
        if (resp3?.pickUpLocation) {
          const respDrop = await whatsappChats.findOneAndUpdate(
            { mobileNumber: senderNumber },
            {
              dropLocation:
                [req.body.entry[0].changes[0].value.messages[0].location.latitude,req.body.entry[0].changes[0].value.messages[0].location.longitude],
              dropAddress: req?.body?.entry[0]?.changes[0].value.messages[0].location?.address
            },
            { new: true },
          );
          const utilsdata = getUtils();
          const nearbyDriversDistanceInKm: any =
            utilsdata.nearbyDriversDistanceInKm;
          const nearbyDriversDistanceInRadians =
            nearbyDriversDistanceInKm / 111.12;
          const availableDrivers = await Driver.find({
            rideStatus: 'online', // is acceptingRides(online) or not (offline)
            status: 'active', // drivers current ride status i.e if on a ride(on-ride) or free(active)
            liveLocation: {
              // $near: [72.9656312, 19.1649861],
              $near: [
                respDrop?.pickUpLocation[1],
                respDrop?.pickUpLocation[0],
                // rideDetails.pickUpLocation[1],
                // rideDetails.pickUpLocation[0],
              ],
              // $maxDistance: nearbyDriversDistanceInRadians,
            },
          })
          .limit(20)
          .lean();
          
          const driver = availableDrivers[0];

          if(!driver){
            interactiveMessageBody['title'] =
            `Driver is not available, Please try again`;
            await sendTextMessagesV2(interactiveMessageBody);
            break;
          }
          console.log("resp",respDrop?.pickUpLocation);
          let newRide: any = await Rides.create({
            pickUpAddress: respDrop?.pickAddress,
            dropAddress: respDrop?.dropAddress,
            // driverPathToPickUp:[{latitude:driver?.liveLocation[0],longitude:driver?.liveLocation[1]},{latitude:respDrop?.pickUpLocation[0],longitude:respDrop?.pickUpLocation[1]}],
            // pickupToDropPath:[{latitude:respDrop?.pickUpLocation[0],longitude:respDrop?.pickUpLocation[1]},{latitude:respDrop?.dropLocation[0],longitude:respDrop?.dropLocation[1]}],
            pickUpLocation: respDrop?.pickUpLocation,
            dropLocation: respDrop?.dropLocation,
            riderId: respDrop?._id,
            vehicleNumber: availableDrivers[0]?.vehicleNumber,
            driverId: availableDrivers[0]?._id,
            bookingTime:new Date(),
            status: 'pending-arrival',
            otp:"0000",
          });
          // const setSocket = setDriverSocket(JSON.stringify(driver._id))
        //   let tempDriverId = driver._id.toString();
        //  const driverSocket =  setDriverSocket(tempDriverId,socket);
        //  const driversSocket = getDriverSocket(tempDriverId);
        //  console.log("driverSocket",driversSocket);
        //  console.log("driverSocket",driverSocket);
        //  driverSocket.emit('ride-request', formatSocketResponse([newRide]));
          // if (driversSocket) {
          //   console.log("driver Socket connected")
          //   driversSocket.emit('ride-request', formatSocketResponse([newRide]));
          //   driversSocket.join(`${newRide._id.toString()}-ride-room`);
          // }
          // console.log("availableDrivers",availableDrivers)
          // IF it's a Scheduled-Ride, then continue:
          // Join the ride room and emit ride-status event
          const formattedString = driver?.vehicleNumber?.replace(/([A-Z]{2})(\d{2})([A-Z]{2})(\d{4})/, "$1-$2-$3-$4");
          interactiveMessageBody['title'] =
            `Thank You, an ambulance is on the way. The driver is ${driver?.firstName} ${driver?.lastName} and the number is +91${driver?.mobileNumber}. Plate number is ${formattedString}`;
          interactiveMessageBody['messages'] = [
            {
              type: 'reply',
              reply: {
                id: `track_Location`,
                title: `Track Location`,
              },
            },
          ];
          await sendTextMessagesV2(interactiveMessageBody);
          break;
        } else {
          const respPick = await whatsappChats.findOneAndUpdate(
            { mobileNumber: senderNumber },
            {
              pickUpLocation:
              [req.body?.entry[0].changes[0].value.messages[0].location.latitude,req.body.entry[0].changes[0].value.messages[0].location.longitude],
              pickAddress:req?.body?.entry[0]?.changes[0].value.messages[0].location?.address
            },
            { new: true },
          );
          if (!respPick) {
            const defaultAddress = "default_value";
            const resp1 = await whatsappChats.create({
              mobileNumber: senderNumber,
              pickUpLocation: [
                req?.body.entry[0]?.changes[0].value.messages[0].location.latitude,
                req?.body.entry[0]?.changes[0].value.messages[0].location.longitude
              ],
              pickAddress: req?.body?.entry[0]?.changes[0].value.messages[0].location?.address || defaultAddress,
            });
          }
        }
        interactiveMessageBody['title'] =
          'Do you need an ambulance with an oxygen cylinder?';
        interactiveMessageBody['messages'] = [
          {
            type: 'reply',
            reply: {
              id: `Yes`,
              title: `Yes`,
            },
          },
          {
            type: 'reply',
            reply: {
              id: `No`,
              title: `No`,
            },
          },
        ];
        await sendInteractiveMessagesButtons1(interactiveMessageBody);
        break;
      }

      case 'board_interactive': {
        interactiveMessageBody['title'] = 'Where do you need to go?';
        interactiveMessageBody['messages'] = [
          {
            type: 'reply',
            reply: {
              id: `dropLoc`,
              title: `Drop Location`,
            },
          },
        ];
        await sendInteractiveMessagesButtons(interactiveMessageBody);
        break;
      }

      case 'driver_interactive' : {
        const respRider = await whatsappChats.findOneAndUpdate(
          { mobileNumber: senderNumber })
        const respRide = await Rides.findOne({riderId:respRider?._id})
        interactiveMessageBody['title'] = 'Plz wait for Location';
        interactiveMessageBody['messages'] = [
          {
            type: 'reply',
            reply: {
              id: `dropLoc`,
              title: `Drop Location`,
            },
          },
        ];
        await sendInteractiveDriverLocation(interactiveMessageBody);
        break;
      }
    }

    res.sendStatus(200);
  } catch (error) {
    console.log(error);
    res.sendStatus(200);
  }
}

async function sendInteractiveMessagesButtons(
  interactiveMessageBody: InteractiveMessageBody,
) {
  try {

    let responce = axios.post(
      `https://graph.facebook.com/v17.0/${interactiveMessageBody.phoneId}/messages`,
      {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: interactiveMessageBody.sender,
        type: 'interactive',
        interactive: {
          type: "location_request_message",
          body: {
            text: `${interactiveMessageBody.title}`,
          },
          action: {
            name: "send_location" 
          },
        },
      },
      {
        headers: {
          authorization: `Bearer ${process.env.WHATSAPP_AUTH_TOKEN}`,
        },
      },
    );
  } catch (error) {
    console.log("error",error);
    throw Error('error in sendInteractiveMessagesButtons');
  }
}

async function sendInteractiveMessagesButtons1(interactiveMessageBody: any) {
  try {
    const response = await axios.post(
      `https://graph.facebook.com/v17.0/${interactiveMessageBody.phoneId}/messages`,
      {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: interactiveMessageBody.sender,
        type: 'interactive',
        interactive: {
          type: 'button',
          body: {
            text: interactiveMessageBody.title,
          },
          action: {
            buttons: interactiveMessageBody.messages,
          },
        },
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_AUTH_TOKEN}`,
        },
      },
    );
  } catch (error) {
    //   console.error('Error in sendInteractiveMessagesButtons:', error.response ? error.response.data : error.message);
    console.log('error', error);
    throw new Error('Error in sendInteractiveMessagesButtons');
  }
}

async function sendInteractiveDriverLocation(
  interactiveMessageBody: InteractiveMessageBody,
) {
  try {
    axios.post(
      `https://graph.facebook.com/v17.0/${interactiveMessageBody.phoneId}/messages`,
      {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: interactiveMessageBody.sender,
        type: 'location',
        location:{
          longitude:72.16,
          latitude:19.78,
          name:"Ganesh",
          address:"Amit",
        }
      },
      {
        headers: {
          authorization: `Bearer ${process.env.WHATSAPP_AUTH_TOKEN}`,
        },
      },
    );
  } catch (error) {
    throw Error('error in sendInteractiveMessagesList');
  }
}

async function sendTextMessagesV2(
  interactiveMessageBody: InteractiveMessageBody,
) {
  try {
    let responce = await axios.post(
      `https://graph.facebook.com/v17.0/${interactiveMessageBody.phoneId}/messages`,
      {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: interactiveMessageBody.sender,
        type: 'text',
        text: {
          preview_url: false,
          body: `${interactiveMessageBody.title}`,
        },
      },
      {
        headers: {
          authorization: `Bearer ${process.env.WHATSAPP_AUTH_TOKEN}`,
        },
      },
    );
  } catch (error) {
    console.log(error);
  }
}
