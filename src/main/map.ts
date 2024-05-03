import {
  addressLatlong,
  addressLatlongmapyindia,
  locationList,
  locationListmapmyindia,
} from '../models';
import { Request, Response } from 'express';
import {
  getAddressFromAutoComplete,
  getAddressFromAutoCompletemapmyindia,
  getAddressFromCoords,
  getAddressFromCoordsmapmyindia,
  getCoordsFromAddress,
  getDirections,
  getDirectionsmapmyindia,
} from '../helpers/common';
import { getUtils } from '..';

const _ = require('lodash');

export async function addressFromCoordinates(req: Request, res: Response) {
  try {
    const body = req.body;
    console.log('get-address-from-coordinates1 >> body :>> ', body);
    // const location = body.location;
    const long = body.longitude;
    const lat = body.latitude;
    const utilsdata = getUtils();
    const nearbyDriversDistanceInKm: any = utilsdata.nearbyDriversDistanceInKm;
    const nearbylocationDistanceInRadians = nearbyDriversDistanceInKm / 111.12;
    const addressDoc: any = await addressLatlong.findOne({
      latlong: {
        $near: [long, lat],
        $maxDistance: nearbylocationDistanceInRadians,
      },
    });
    if (addressDoc) {
      console.log('returned data caches from mongo db', addressDoc);
      res.status(200).send({
        message: 'Address fetched successfully.',
        data: { address: addressDoc.address },
      });
    } else {
      console.log('Calling Google Places API.');
      console.log('location ---> ', body);

      const address = await getAddressFromCoords(body);

      // console.log(`get-address-from-coordinates >> address :>> `, address);
      if (address == 'undefined') {
        return res.status(400).send({ error: 'Coordinates are invalid' });
      }
      const addressDoc = await addressLatlong.create({
        address,
        latlong: [long, lat],
      });
      return res.status(200).send({
        message: 'Fetched address successfully.',
        data: { address },
      });
    }
  } catch (error: any) {
    console.log('get-address-from-coordinates error: ', error);
    res.status(400).send({ error: error.message });
  }
}


// export async function addressFromCoordinatesmapmyindia(
//   req: Request,
//   res: Response,
// ) {
//   try {
//     const location = req.body;
//     console.log('get-address-from-coordinates2 >> body :>> ', location);
//     // const location = body.location;
//     const long = location.longitude;
//     const lat = location.latitude;

//     const utilsdata = getUtils();
//     // const nearbyDriversDistanceInKm: any = utilsdata.nearbyDriversDistanceInKm;
//     // const nearbylocationDistanceInRadians = nearbyDriversDistanceInKm / 111.12;
//     const radiusInKm = 2;
//     const nearbylocationDistanceInRadians1 = radiusInKm / 6371;
//     const addressDoc: any = await addressLatlongmapyindia.findOne({
//       latlong: {
//         $near: [long, lat],
//         // $maxDistance: nearbylocationDistanceInRadians,
//         $maxDistance: nearbylocationDistanceInRadians1,
//       },
//     });

//     console.log('adddress', addressDoc);
//     if (addressDoc) {
//       console.log('returned data caches from mongo db', addressDoc);
//       res.status(200).send({
//         message: 'Address fetched successfully.',
//         data: { address: addressDoc.address },
//       });
//     } else {
//       console.log('Calling Google Places API.');
//       console.log('location ---> ', location);

//       const address = await getAddressFromCoordsmapmyindia(location);

//       console.log(`get-address-from-coordinates >> address :>> `, address);
//       //   if (address == 'undefined') {
//       //     return res.status(400).send({ error: 'Coordinates are invalid' });
//       //   }
//       console.log('dddddddd', long, lat);
//       const addressDoc = await addressLatlongmapyindia.create({
//         address,
//         latlong: [long, lat],
//       });
//       return res.status(200).send({
//         message: 'Fetched address successfully.',
//         data: { address },
//       });
//     }
//   } catch (error: any) {
//     console.log('get-address-from-coordinates error: ', error);
//     res.status(400).send({ error: error.message });
//   }
// }
export async function addressFromCoordinatesmapmyindia(
  req: Request,
  res: Response,
) {
  try {
    const location = req.body;
    console.log('get-address-from-coordinates2 >> body :>> ', location);

    const long = location.longitude;
    const lat = location.latitude;

    const utilsdata = getUtils();
    const radiusInKm = 0.1;
    const nearbylocationDistanceInRadians1 = radiusInKm / 6371;

    const existingAddressDoc: any = await addressLatlongmapyindia.findOne({
      latlong: {
        $near: [long, lat],
        $maxDistance: nearbylocationDistanceInRadians1,
      },
    });

    if (existingAddressDoc) {
      console.log('Returned data from MongoDB:', existingAddressDoc);
      return res.status(200).send({
        message: 'Address fetched successfully.',
        data: { address: existingAddressDoc.address },
      });
    }

    console.log('Calling Google Places API.');
    console.log('location ---> ', location);

    const address = await getAddressFromCoordsmapmyindia(location);

    console.log(`get-address-from-coordinates >> address :>> `, address);

    const newAddressDoc = await addressLatlongmapyindia.create({
      address,
      latlong: [long, lat],
    });

    return res.status(200).send({
      message: 'Fetched address successfully.',
      data: { address: newAddressDoc.address },
    });
  } catch (error: any) {
    console.log('get-address-from-coordinates error: ', error);
    res.status(400).send({ error: error.message });
  }
}

export async function addressFromCoordinatesmapmyindiaForWhatsapp(body:any) {
  try {
    const location = body;
    console.log('get-address-from-coordinates2 >> body :>> ', location);

    const lat = location.longitude;
    const long = location.latitude;

    const utilsdata = getUtils();
    const radiusInKm = 1;
    const nearbylocationDistanceInRadians1 = radiusInKm / 111.12;

    const existingAddressDoc: any = await addressLatlongmapyindia.findOne({
      latlong: {
        $near: [long, lat],
        $maxDistance: nearbylocationDistanceInRadians1,
      },
    });

    if (existingAddressDoc) {
      console.log('Returned data from MongoDB:', existingAddressDoc);
      return {
        message: 'Address fetched successfully.',
        data: { address: existingAddressDoc.address },
      };
    }

    console.log('Calling Google Places API.');
    console.log('location ---> ', location);

    const address = await getAddressFromCoordsmapmyindia(location);

    console.log(`get-address-from-coordinates >> address :>> `, address);

    const newAddressDoc = await addressLatlongmapyindia.create({
      address,
      latlong: [long, lat],
    });

    return {
      message: 'Fetched address successfully.',
      data: { address: newAddressDoc.address },
    };
  } catch (error: any) {
    console.log('get-address-from-coordinates error: ', error);
  }
}



export async function coordinatesFromAddress(req: Request, res: Response) {
  try {
    const body = req.body;
    const address = body.address;
    if (!address) {
      throw new Error('Address is missing.');
    }
    // Check if the requested address coordinates are cached in MongoDB
    const addressDoc = await addressLatlong.findOne({ address });

    // console.log('address-->', addressDoc?.latlong);

    if (addressDoc) {
      console.log('Returned google places cached from MongoDB.');

      // Fetch coordinates from Google Geocoding API using address
      return res.status(200).send({
        message: 'Fetched places from mongodb successfully.',
        data: { latlong: addressDoc.latlong },
      });
    } else {
      console.log('Calling Google Places API.');
      const coordinates: any = await getCoordsFromAddress(address);
      // console.log(
      //   `get-coordinates-from-address >> coordinates :>> `,
      //   coordinates,
      // );
      if (coordinates == 'undefined') {
        throw new Error('Address is invalid');
        // return res.status(400).send({ error: 'Address is invalid' });
      }

      // Send the fetched coordinates and cache them in MongoDB
      res.status(200).send({
        message: ' fetched coordinates successfully.',
        data: { latlong: coordinates },
      });
      let addressDoc = await addressLatlong.create({
        address,
        latlong: coordinates,
      });
    }
  } catch (error: any) {
    console.log('get-address-from-coordinates error: ', error);
    res.status(400).send({ error: error.message });
  }
}

export async function getDirection(req: Request, res: Response) {
  try {
    const body = req.body;
    const { location1, location2 } = body;
    if (!location1 || !location2) {
      throw new Error('Coordinates is missing.');
    }

    // Check if the requested address is cached in MongoDB
    // const directionDoc: any = await getDirect.findOne(
    //   {location1: { longitude, latitude },
    //   location2: { longitude, latitude }}
    // );
    // if (addressDoc) {
    //   console.log('returned data caches from mongo db', addressDoc);
    //   res.status(200).send({
    //     message: 'Address fetched successfully.',
    //     data: { address: addressDoc.address },
    //   });
    // } else {
    //   console.log('Calling Google Places API.');

    // Fetch address from Google Geocoding API using coordinates
    // const address = await getAddressFromCoords(body);

    // if (address == 'undefined') {
    //   throw new Error('Coordinates are invalid');
    //   // return res.status(400).send({ error: 'Coordinates are invalid' });
    // }

    // Cache the fetched address in MongoDB
    //   const addressDoc = await getDirect.create({
    //     location1:[location1.long,location1.lat],
    //     location2:[location2.long,location2.lat],
    //     cord:["454"],
    //     distance:"45",
    //     duration:"10min"
    //   });
    //   return res.status(200).send({
    //     message: 'Fetched address successfully.',
    //     // data: { address },
    //   });
    // }
    // Fetch directions between two locations using a map service
    const response = await getDirections(location1, location2);

    // Send the fetched directions data
    return res
      .status(200)
      .send({ message: 'Fetched directions successfully.', data: response });
  } catch (error: any) {
    console.log('get-directions error: ', error);
    res.status(400).send({ error: error.message });
  }
}
export async function getDirectionmapmyindia(req: Request, res: Response) {
  try {
    const body = req.body;
    const { location1, location2 } = body;
    if (!location1 || !location2) {
      throw new Error('Coordinates is missing.');
    }
    // Fetch directions between two locations using a map service
    const response = await getDirectionsmapmyindia(location1, location2);

    // Send the fetched directions data
    return res.status(200).send({
      message: 'Fetched directions from map-my-india successfully.',
      data: response,
    });
  } catch (error: any) {
    console.log('get-directions-map-my-india error: ', error);
    res.status(400).send({ error: error.message });
  }
}

export async function getAddressFromAutocomplete(req: Request, res: Response) {
  try {
    const body = req.body;
    console.log("----------------", body)
    const text = body.text.toLowerCase();
    if (!text) {
      throw new Error('text is missing.');
    }
    // Check if the requested location predictions are cached in MongoDB
    // const locationsDoc = await locationList
    //   .findOne({
    //     text,
    //   })
    //   .lean();
    // if (locationsDoc) {
    //   console.log('Returned google places cached from MongoDB.');
    //   return res.status(200).send({
    //     message: 'Fetched places from mongodb successfully.',
    //     data: { predictions: locationsDoc.predictions },
    //   });
    // } else {
      console.log('Calling Google Places API.');
      // Fetch predictions from Google Places API
      const response: any = await getAddressFromAutoComplete(text);
      res.status(200).send({
        message: 'Gooogle Places fetched successfully.',
        data: { predictions: response.data.predictions },
      });
      // Cache the fetched predictions in MongoDB
      // let createdDoc = await locationList.create({
      //   text,
      //   predictions: response.data.predictions,
      // });
    // }
  } catch (error: any) {
    console.log('get-address-from-autocomplete error: ', error);
    res.status(400).send({ error: error.message });
  }
}
export async function getAddressFromAutocompletemapmyindia(
  req: Request,
  res: Response,
) {
  try {
    const body = req.body;
    const text = body.text.toLowerCase();
    if (!text) {
      throw new Error('text is missing.');
    }
    // // Check if the requested location predictions are cached in MongoDB
    // const locationsDoc: any = await locationListmapmyindia
    //   .findOne({
    //     text,
    //   })
    //   .lean();
    // if (locationsDoc) {
    //   console.log('Returned MapMyIndia places cached from MongoDB.');
    //   return res.status(200).send({
    //     message: 'Fetched places from mongodb successfully.',
    //     data: { predictions: locationsDoc.predictions },
    //   });
    // } else {
      console.log('Calling MapMyIndia Places API.');
      // Fetch predictions from Google Places API
      const response: any = await getAddressFromAutoCompletemapmyindia(text);
      // console.log('response---->', response)
      res.status(200).send({
        message: 'MapMyIndia Places fetched successfully.',
        data: { predictions: response.data.suggestedLocations },
      });
      // Cache the fetched predictions in MongoDB
      // let createdDoc = await locationListmapmyindia.create({
      //   text,
      //   predictions: response.data.suggestedLocations,
      // });
    // }
  } catch (error: any) {
    console.log('get-address-from-autocomplete error: ', error);
    res.status(400).send({ error: error.message });
    // }
  }
}
