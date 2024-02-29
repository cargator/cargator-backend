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
import { Resend } from 'resend';
import { Driver, Rides, whatsappChats } from '../models';
import { getUtils } from '..';
import environmentVars from '../constantsVars';
dotenv.config();

const resendClient = new Resend(environmentVars.EMAIL_AUTHKEY);
let statPoints = [
  'Ambulance flow',
  'Taxi flow',
  'Tow Truck Flow',
  'Contact us',
];

interface InteractiveMessageBody {
  [key: string]: any;
}

export async function handleWebhookVerification(req: Request, res: Response) {
  console.log(req.query['hub.verify_token']);
  console.log(req.query['hub.challenge']);
  res.send(req.query['hub.challenge']);
}

export async function handleWebhookPost(req: Request, res: Response) {
  try {
    console.log('whatsAppChatBot');
    const interactiveMessageBody: InteractiveMessageBody = {};
    // let riderData: InteractiveMessageBody = {};
    const body_param = req.body;
    let typeOfInteractive, idOfInteractive, idOfInteractiveListReply;

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

    // getting phone-number and id for sending reply
    interactiveMessageBody['sender'] = senderNumber;
    interactiveMessageBody['phoneId'] = phoneId;

    // sending welcome message with sending request for pickup location
    if (typeOfMessage == 'text') {
      // console.log('req', req.body?.entry[0].changes[0].value.messages[0].text);
      const text = req.body?.entry[0].changes[0].value.messages[0].text.body;
      // checking email address or simple text
      if (text.includes('@')) {
        const name =
          req?.body?.entry[0]?.changes[0].value.contacts[0]?.profile.name;
        const currentTime = new Date();
        const date = currentTime.toLocaleString('en-US', {
          timeZone: 'Asia/Kolkata',
        });
        // console.log("pN",name)
        // console.log("date",date);
        // console.log("senderNumber",senderNumber);
        // console.log("text",text);

        const htmldata = `<h2><strong>Trip Details</strong></h2>
        <ul>
          <li>Date/Time of request: <span id="date">${[date]}</span></li>
          <li>Rider Name: <span id="senderName">${[name]}</span></li>
          <li>Rider Number: <span id="senderNumber">${[
            senderNumber,
          ]}</span></li> 
          <li>Email: <span id="email">${[text]}</span></li> 
        </ul>`;

        const mailParams = {
          from: 'CarGator <hello@cargator.org>',
          to: ['beep@cargator.org'],
          subject: 'Trip Details',
          html: htmldata,
        };

        resendClient.emails
          .send(mailParams)
          .then((response) => {
            console.log(`Sent message ${JSON.stringify(response)}`);
          })
          .catch((error) => {
            console.error(`Error while sending email: ${error}`);
          });

        await emailReply(interactiveMessageBody);
      } else {
        await textReply(senderNumber, interactiveMessageBody);
      }
    }

    // accepting pickup location and drop location here , According to that we are sending reply
    if (typeOfMessage == 'location') {
      // console.log('req', req.body?.entry[0]?.changes[0].value.messages[0].id);
      await locationReply(
        senderNumber,
        interactiveMessageBody,
        req,
        idOfInteractiveListReply,
      );
    }

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

      idOfInteractiveListReply = get(
        body_param,
        'entry[0].changes[0].value.messages[0].interactive.list_reply.id',
        undefined,
      );

      // console.log('typeOfInteractive', typeOfInteractive);
      // console.log('idOfInteractive', idOfInteractive);
      // console.log('idOfInteractiveListReply', idOfInteractiveListReply);

      // converting typeOfMessage for understanding what type of message i have to send for reply
      if (
        typeOfInteractive == 'button_reply' &&
        idOfInteractive.startsWith('Ambulance_flow')
      ) {
        // sending request for Drop location with text
        await ambulanceFlow(senderNumber, interactiveMessageBody);
      }
      // if (
      //   typeOfInteractive == 'button_reply' &&
      //   idOfInteractive.startsWith('Taxi_flow_Reply')
      // ) {
      //   // sending request for Drop location with text
      //   await taxiFlow(senderNumber, interactiveMessageBody);
      // }
      if (
        typeOfInteractive == 'button_reply' &&
        idOfInteractive.startsWith('Tow_Truck_flow')
      ) {
        // sending request for Drop location with text
        await towTruckFlow(senderNumber, interactiveMessageBody);
      }
      if (
        typeOfInteractive == 'button_reply' &&
        idOfInteractive.startsWith('Contact_us_Reply')
      ) {
        // sending request for Drop location with text
        await contactUsReply(senderNumber, interactiveMessageBody);
      }
      if (
        typeOfInteractive == 'button_reply' &&
        idOfInteractive.startsWith('Maruti')
      ) {
        const respDrop = await whatsappChats.findOneAndUpdate(
          { mobileNumber: senderNumber },
          {
            make: 'Maruti',
          },
          { new: true },
        );
        // console.log("make",respDrop)
        // sending request for Drop location with text
        await marutiCar(interactiveMessageBody);
      }
      if (
        typeOfInteractive == 'button_reply' &&
        idOfInteractive.startsWith('Hyundai')
      ) {
        const respDrop = await whatsappChats.findOneAndUpdate(
          { mobileNumber: senderNumber },
          {
            make: 'Hyundai',
          },
          { new: true },
        );
        // console.log("make",respDrop)
        // sending request for Drop location with text
        await hyundaiCar(interactiveMessageBody);
      }
      if (
        typeOfInteractive == 'button_reply' &&
        idOfInteractive.startsWith('Porsche')
      ) {
        const respDrop = await whatsappChats.findOneAndUpdate(
          { mobileNumber: senderNumber },
          {
            make: 'Porsche',
          },
          { new: true },
        );
        // console.log("make",respDrop)
        // sending request for Drop location with text
        await porscheCar(interactiveMessageBody);
      }
      if (
        (typeOfInteractive == 'button_reply' &&
          idOfInteractive.startsWith('Ertiga')) ||
        (typeOfInteractive == 'button_reply' &&
          idOfInteractive.startsWith('Swift')) ||
        (typeOfInteractive == 'button_reply' &&
          idOfInteractive.startsWith('Creta')) ||
        (typeOfInteractive == 'button_reply' &&
          idOfInteractive.startsWith('i20')) ||
        (typeOfInteractive == 'button_reply' &&
          idOfInteractive.startsWith('Macan')) ||
        (typeOfInteractive == 'button_reply' &&
          idOfInteractive.startsWith('911'))
      ) {
        const respDrop = await whatsappChats.findOneAndUpdate(
          { mobileNumber: senderNumber },
          {
            model: idOfInteractive,
          },
          { new: true },
        );
        // console.log("model",respDrop)
        interactiveMessageBody['title'] = 'Do you require a flatbed tow truck?';

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

        await sendInteractiveMessagesYesNoButtons(interactiveMessageBody);
      }
      if (
        typeOfInteractive == 'button_reply' &&
        idOfInteractive.startsWith('Yes')
      ) {
        // added oxygenCylinder status in db and sending request for Drop location with text
        const respDrop = await whatsappChats.findOneAndUpdate(
          { mobileNumber: senderNumber },
          {
            oxygenCylinder: 'Yes',
          },
          { new: true },
        );
        await dropLocationRequest(interactiveMessageBody);
      }
      if (
        typeOfInteractive == 'button_reply' &&
        idOfInteractive.startsWith('No')
      ) {
        //  added oxygenCylinder status in db  and sending request for Drop location with text
        const respDrop = await whatsappChats.findOneAndUpdate(
          { mobileNumber: senderNumber },
          {
            oxygenCylinder: 'No',
          },
          { new: true },
        );
        await dropLocationRequest(interactiveMessageBody);
      }
    }

    res.sendStatus(200);
  } catch (error) {
    console.log(error);
    res.sendStatus(200);
  }
}

async function textReply(senderNumber: any, interactiveMessageBody: any) {
  try {
    const resp3 = await whatsappChats.findOneAndUpdate(
      { mobileNumber: senderNumber },
      {
        dropLocation: null,
        pickUpLocation: null,
        pickAddress: null,
        dropAddress: null,
        flowType: null,
        oxygenCylinder: null,
        make:null,
        model:null,
      },
      { new: true },
    );

    interactiveMessageBody['title'] =
      'Welcome to the CarGator chatbot, the open-source mobility stack.\n \nYou can try several user flows via this interface, please select from below list.';
    interactiveMessageBody['messages'] = [
      {
        type: 'reply',
        reply: {
          id: `Ambulance_flow`,
          title: `Ambulance flow`,
        },
      },
      {
        type: 'reply',
        reply: {
          id: `Tow_Truck_flow`,
          title: `Tow Truck flow`,
        },
      },
      {
        type: 'reply',
        reply: {
          id: `Contact_us_Reply`,
          title: `Contact us`,
        },
      },
    ];

    await sendInteractiveMessagesYesNoButtons(interactiveMessageBody);
    // interactiveMessageBody['heading'] = 'FLOW OPTIONS';
    // await sendInteractiveMessagesList(interactiveMessageBody);
  } catch (error) {
    console.log('error', error);
    throw Error('error in textReply');
  }
}

async function ambulanceFlow(senderNumber: any, interactiveMessageBody: any) {
  try {
    const resp3 = await whatsappChats.findOneAndUpdate(
      { mobileNumber: senderNumber },
      {
        dropLocation: null,
        pickUpLocation: null,
        pickAddress: null,
        dropAddress: null,
        flowType: 'Ambulance_Service',
        oxygenCylinder: null,
        make:null,
        model:null,
      },
      { new: true },
    );

    interactiveMessageBody['title'] =
      'Hello, Thank You for contacting XYZ ambulance. Please share your current/preferred location for an ambulance pickup.';
    interactiveMessageBody['messages'] = [
      {
        type: 'reply',
        reply: {
          id: `sendLoc`,
          title: `Send Location`,
        },
      },
    ];

    // await sendInteractiveMessagesOptionsButtons(interactiveMessageBody);
    await sendInteractiveMessagesButtons(interactiveMessageBody);
  } catch (error) {
    console.log('error', error);
    throw Error('error in textReply');
  }
}

async function towTruckFlow(senderNumber: any, interactiveMessageBody: any) {
  try {
    const resp3 = await whatsappChats.findOneAndUpdate(
      { mobileNumber: senderNumber },
      {
        dropLocation: null,
        pickUpLocation: null,
        pickAddress: null,
        dropAddress: null,
        flowType: 'Towing_Service',
        oxygenCylinder: null,
        make:null,
        model:null,
      },
      { new: true },
    );

    interactiveMessageBody['title'] =
      'Hello, Thank You for contacting Mumbai Towing Service. Please share your current/preferred location for a tow truck.';
    interactiveMessageBody['messages'] = [
      {
        type: 'reply',
        reply: {
          id: `sendLoc`,
          title: `Send Location`,
        },
      },
    ];

    // await sendInteractiveMessagesOptionsButtons(interactiveMessageBody);
    await sendInteractiveMessagesButtons(interactiveMessageBody);
  } catch (error) {
    console.log('error', error);
    throw Error('error in textReply');
  }
}

async function contactUsReply(senderNumber: any, interactiveMessageBody: any) {
  try {
    interactiveMessageBody['title'] =
      'Contact me is just a text box: \n \nPlease enter your email address and we will contact you. Thank you';
    interactiveMessageBody['messages'] = [
      {
        type: 'reply',
        reply: {
          id: `sendEmail`,
          title: `Send Email`,
        },
      },
    ];

    await sendInteractiveMessagesForContact(interactiveMessageBody);
  } catch (error) {
    console.log('error', error);
    throw Error('error in textReply');
  }
}

// async function taxiFlow(senderNumber: any, interactiveMessageBody: any) {
//   try {
//     interactiveMessageBody['title'] = 'Coming Soon…';
//     await sendTextMessages(interactiveMessageBody);
//   } catch (error) {
//     console.log('error', error);
//     throw Error('error in textReply');
//   }
// }

async function emailReply(interactiveMessageBody: any) {
  interactiveMessageBody[
    'title'
  ] = `Thank you for providing your email address.`;

  await sendTextMessages(interactiveMessageBody);
}

async function locationReply(
  senderNumber: any,
  interactiveMessageBody: any,
  req: any,
  idOfInteractiveListReply: any,
) {
  try {
    // getting senderNumber Data in DB
    const resp = await whatsappChats.findOne({
      mobileNumber: senderNumber,
    });

    // if already i have pickupLocation in db then storing drop location in db and create ride .
    if (resp?.pickUpLocation) {
      await addingDropLocAndCreateRide(
        senderNumber,
        interactiveMessageBody,
        req,
      );
      return;
    }

    // if pickupLocation not present in Db then storing pickup location in db
    await addingPickupLocation(senderNumber, req);

    if (resp?.flowType === 'Towing_Service' && !resp?.oxygenCylinder) {
      interactiveMessageBody['title'] = 'Select your Make';

      interactiveMessageBody['messages'] = [
        {
          type: 'reply',
          reply: {
            id: `Maruti`,
            title: `Maruti`,
          },
        },
        {
          type: 'reply',
          reply: {
            id: `Hyundai`,
            title: `Hyundai`,
          },
        },
        {
          type: 'reply',
          reply: {
            id: `Porsche`,
            title: `Porsche`,
          },
        },
      ];

      await sendInteractiveMessagesYesNoButtons(interactiveMessageBody);
      return;
    }

    // sending OxygenCylinder Request YES Or NO .
    // if (resp?.flowType === 'Towing_Service') {
    //   interactiveMessageBody['title'] = 'Do you require a flatbed tow truck?';

    //   interactiveMessageBody['messages'] = [
    //     {
    //       type: 'reply',
    //       reply: {
    //         id: `Yes`,
    //         title: `Yes`,
    //       },
    //     },
    //     {
    //       type: 'reply',
    //       reply: {
    //         id: `No`,
    //         title: `No`,
    //       },
    //     },
    //   ];

    //   await sendInteractiveMessagesYesNoButtons(interactiveMessageBody);
    //   return;
    // }

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

    await sendInteractiveMessagesYesNoButtons(interactiveMessageBody);
  } catch (error) {
    console.log('error', error);
    throw Error('error in locationReply');
  }
}

async function marutiCar(interactiveMessageBody: any) {
  try {
    interactiveMessageBody['title'] = 'Select your Model';
    interactiveMessageBody['messages'] = [
      {
        type: 'reply',
        reply: {
          id: `Ertiga`,
          title: `Ertiga`,
        },
      },
      {
        type: 'reply',
        reply: {
          id: `Swift`,
          title: `Swift`,
        },
      },
    ];

    await sendInteractiveMessagesYesNoButtons(interactiveMessageBody);
  } catch (error) {
    console.log('error', error);
    throw Error('error in dropLocationRequest');
  }
}

async function hyundaiCar(interactiveMessageBody: any) {
  try {
    interactiveMessageBody['title'] = 'Select your Model';
    interactiveMessageBody['messages'] = [
      {
        type: 'reply',
        reply: {
          id: `Creta`,
          title: `Creta`,
        },
      },
      {
        type: 'reply',
        reply: {
          id: `i20`,
          title: `i20`,
        },
      },
    ];

    await sendInteractiveMessagesYesNoButtons(interactiveMessageBody);
  } catch (error) {
    console.log('error', error);
    throw Error('error in dropLocationRequest');
  }
}

async function porscheCar(interactiveMessageBody: any) {
  try {
    interactiveMessageBody['title'] = 'Select your Model';
    interactiveMessageBody['messages'] = [
      {
        type: 'reply',
        reply: {
          id: `Macan`,
          title: `Macan`,
        },
      },
      {
        type: 'reply',
        reply: {
          id: `911`,
          title: `911`,
        },
      },
    ];

    await sendInteractiveMessagesYesNoButtons(interactiveMessageBody);
  } catch (error) {
    console.log('error', error);
    throw Error('error in dropLocationRequest');
  }
}

async function dropLocationRequest(interactiveMessageBody: any) {
  try {
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
  } catch (error) {
    console.log('error', error);
    throw Error('error in dropLocationRequest');
  }
}

async function addingPickupLocation(senderNumber: any, req: any) {
  try {
    // if already user data or number present in db then we are updating pickupLocation
    const respPick = await whatsappChats.findOneAndUpdate(
      { mobileNumber: senderNumber },
      {
        pickUpLocation: [
          req.body?.entry[0].changes[0].value.messages[0].location.latitude,
          req.body?.entry[0].changes[0].value.messages[0].location.longitude,
        ],
        pickAddress:
          req?.body?.entry[0]?.changes[0].value.messages[0].location?.address,
      },
      { new: true },
    );

    // if already user data or number is present in db then creating new entry in DB with pickupLoaction
    if (!respPick) {
      const resp1 = await whatsappChats.create({
        mobileNumber: senderNumber,
        pickUpLocation: [
          req?.body.entry[0]?.changes[0].value.messages[0].location.latitude,
          req?.body.entry[0]?.changes[0].value.messages[0].location.longitude,
        ],
        pickAddress:
          req?.body?.entry[0]?.changes[0].value.messages[0].location?.address ||
          '',
      });
    }
  } catch (error) {
    console.log('error', error);
    throw Error('error in addingPickupLocation');
  }
}

async function addingDropLocAndCreateRide(
  senderNumber: any,
  interactiveMessageBody: any,
  req: any,
) {
  try {
    // adding drop location in DB
    const respDrop = await whatsappChats.findOneAndUpdate(
      { mobileNumber: senderNumber },
      {
        dropLocation: [
          req.body.entry[0].changes[0].value.messages[0].location.latitude,
          req.body.entry[0].changes[0].value.messages[0].location.longitude,
        ],
        dropAddress:
          req?.body?.entry[0]?.changes[0].value.messages[0].location?.address,
      },
      { new: true },
    );
    // const utilsdata = getUtils();
    // const nearbyDriversDistanceInKm: any =
    //   utilsdata.nearbyDriversDistanceInKm;
    // const nearbyDriversDistanceInRadians =
    //   nearbyDriversDistanceInKm / 111.12;

    const nearbyDriversDistanceInRadians = 5 / 111.12;

    // finding near by Drivers for Rider
    const availableDrivers = await Driver.find({
      rideStatus: 'online', // is acceptingRides(online) or not (offline)
      status: 'active', // drivers current ride status i.e if on a ride(on-ride) or free(active)
      liveLocation: {
        $near: [respDrop?.pickUpLocation[1], respDrop?.pickUpLocation[0]],
        $maxDistance: nearbyDriversDistanceInRadians,
      },
    })
      .limit(20)
      .lean();

    const driver = availableDrivers[0];

    //sending email to organization
    // console.log("Data",senderNumber,respDrop?.pickAddress,respDrop?.dropAddress,respDrop?.pickUpLocation[0],respDrop?.pickUpLocation[1]
    // ,respDrop?.dropLocation[0],respDrop?.dropLocation[1])
    // console.log("name",req?.body.entry[0].changes[0].value.contacts[0].profile.name);
    // console.log("Oxygen",respDrop)
    const name =
      req?.body?.entry[0]?.changes[0].value.contacts[0]?.profile.name;
    const oxygenCylinder = respDrop?.oxygenCylinder;
    const make = respDrop?.make;
    const model = respDrop?.model;
    const currentTime = new Date();
    const date = currentTime.toLocaleString('en-US', {
      timeZone: 'Asia/Kolkata',
    });
    // console.log("date",date);
    // console.log("make",make)
    // console.log("model",model)

    const htmldata = `<h2><strong>Trip Details</strong></h2>
    <ul>
        <li>Date/Time of request: <span id="date">${[date]}</span></li>
        <li>Rider Name: <span id="senderName">${[name]}</span></li>
        <li>Rider Number: <span id="senderNumber">${[senderNumber]}</span></li> 
        <li>${
          respDrop?.flowType === 'Towing_Service'
            ? 'Flatbed Tow Truck'
            : 'Oxygen Cylinder'
        }: <span id="oxygenCylinder">${[oxygenCylinder]}</span></li> 
        ${respDrop?.flowType === 'Towing_Service' && `<li>Make: <span id="senderNumber">${[make]}</span></li>`}
        ${respDrop?.flowType === 'Towing_Service' && `<li>Model: <span id="senderNumber">${[model]}</span></li>`}
        <li>Pickup Address: <span id="pickUpAddress">${[
          respDrop?.pickAddress,
        ]}</span></li>
        <li>Pickup geo: 
            <ul>
                <li>Latitude: ${[respDrop?.pickUpLocation[0]]}</li>
                <li>Longitude: ${[respDrop?.pickUpLocation[1]]}</li>
            </ul>
        </li>
        <li>Drop off Address: <span id="dropAddress">${[
          respDrop?.dropAddress,
        ]}</span></li>
        <li>Drop geo: 
            <ul>
                <li>Latitude: ${[respDrop?.dropLocation[0]]}</li>
                <li>Longitude: ${[respDrop?.dropLocation[1]]}</li>
            </ul>
        </li>
    </ul>`;

    const mailParams = {
      from: 'CarGator <hello@cargator.org>',
      to: ['beep@cargator.org'],
      subject: 'Trip Details',
      html: htmldata,
    };

    resendClient.emails
      .send(mailParams)
      .then((response) => {
        console.log(`Sent message ${JSON.stringify(response)}`);
      })
      .catch((error) => {
        console.error(`Error while sending email: ${error}`);
      });

    // driver is not present
    console.log('resp', respDrop?.flowType);
    if (!driver) {
      interactiveMessageBody[
        'title'
      ] = `Driver is not available, Please try again`;
      await sendTextMessages(interactiveMessageBody);
      return;
    }
    // console.log('resp', respDrop?.pickUpLocation);

    // Creating rides
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
      platform: 'whatsApp',
      bookingTime: new Date(),
      status: 'pending-arrival',
      otp: '0000',
    });

    const formattedString = driver?.vehicleNumber?.replace(
      /([A-Z]{2})(\d{2})([A-Z]{2})(\d{4})/,
      '$1-$2-$3-$4',
    );

    // sending driver information to user
    if (respDrop?.flowType === 'Towing_Service') {
      // for towing service
      interactiveMessageBody[
        'title'
      ] = `Thank You, The tow truck is on the way. The driver is ${driver?.firstName} ${driver?.lastName} and the number is +${driver?.mobileNumber}. Plate number is ${formattedString}`;

      await sendTextMessages(interactiveMessageBody);
      return;
    }

    // for ambulance service
    interactiveMessageBody[
      'title'
    ] = `Thank You, an ambulance is on the way. The driver is ${driver?.firstName} ${driver?.lastName} and the number is +${driver?.mobileNumber}. Plate number is ${formattedString}`;

    await sendTextMessages(interactiveMessageBody);
  } catch (error) {
    console.log('error', error);
    throw Error('error in addingDropLocAndCreateRide');
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
          type: 'location_request_message',
          body: {
            text: `${interactiveMessageBody.title}`,
          },
          action: {
            name: 'send_location',
          },
        },
      },
      {
        headers: {
          authorization: `Bearer ${environmentVars.WHATSAPP_AUTH_TOKEN}`,
        },
      },
    );
  } catch (error) {
    console.log('error', error);
    throw Error('error in sendInteractiveMessagesButtons');
  }
}

async function sendInteractiveMessagesList(interactiveMessageBody: any) {
  try {
    axios.post(
      `https://graph.facebook.com/v17.0/${interactiveMessageBody.phoneId}/messages`,
      {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: interactiveMessageBody.sender,
        type: 'interactive',
        interactive: {
          type: 'list',
          body: {
            text: `${interactiveMessageBody.title}`,
          },
          action: {
            button: interactiveMessageBody.heading,
            sections: interactiveMessageBody.messages,
          },
        },
      },
      {
        headers: {
          authorization: `Bearer ${environmentVars.WHATSAPP_AUTH_TOKEN}`,
        },
      },
    );
  } catch (error) {
    throw Error('error in sendInteractiveMessagesList');
  }
}

async function sendInteractiveMessagesYesNoButtons(
  interactiveMessageBody: any,
) {
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
          Authorization: `Bearer ${environmentVars.WHATSAPP_AUTH_TOKEN}`,
        },
      },
    );
  } catch (error) {
    //   console.error('Error in sendInteractiveMessagesButtons:', error.response ? error.response.data : error.message);
    console.log('error', error);
    throw new Error('Error in sendInteractiveMessagesButtons');
  }
}

async function sendTextMessages(
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
          authorization: `Bearer ${environmentVars.WHATSAPP_AUTH_TOKEN}`,
        },
      },
    );
  } catch (error) {
    console.log(error);
    throw Error('error in sendInteractiveMessages');
  }
}

async function sendInteractiveMessagesForContact(
  interactiveMessageBody: InteractiveMessageBody,
) {
  try {
    let response = await axios.post(
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
          authorization: `Bearer ${environmentVars.WHATSAPP_AUTH_TOKEN}`,
        },
      },
    );
  } catch (error) {
    console.log('error', error);
    throw Error('error in sendInteractiveMessagesButtons');
  }
}
