import axios from 'axios';
import { isEmpty } from 'lodash';
import { decode } from '@mapbox/polyline';
import constants from '../constantsVars';
import { access_token } from '..';
import { AdminAction } from '../shared/enums/status.enum';
import { Document, Types } from 'mongoose';
import { LogActivity } from '../models/logActivity.model';

const token_type = 'bearer';

function formatSocketResponse(data: any) {
  return JSON.stringify(data);
}

// Function to refresh the token

const getAddressFromAutoComplete = async (text: string | undefined) => {
  try {
    if (isEmpty(text)) {
      return console.log(
        'getAddressFromAutoComplete Error: text is undefined.',
      );
    }

    let googlePlacesRes = await axios.get(
      `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${text}&key=${constants.GOOGLE_API_KEY}`,
    );
    // console.log("googlePlacesRes:>>>>>>>>>>>>>", googlePlacesRes.data);
    // const extractedData = [];
    // for (const prediction of googlePlacesRes?.data?.predictions) {
    //   extractedData.push(prediction.description);
    // }
    // console.log("extractedData:", extractedData);
    return googlePlacesRes;
  } catch (error) {
    console.log('getAddressFromAutoComplete error', error);
  }
};

export const pushlogActivity = async (
  req: any,
  action: AdminAction,
  subject: String,
  admin_id: Types.ObjectId,
  responseBody?: Object,
) => {
  const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  const userAgent = req.headers['user-agent'];
  const logEntry = {
    admin_id,
    action,
    subject,
    details: {
      ip,
      userAgent,
      method: req.method,
      url: req.originalUrl,
      queryParams: JSON.stringify(req.query),
      body: responseBody,
    },
  };
  const logActivityDoc = await LogActivity.create(logEntry);
};

const getAddressFromAutoCompleteOlaMaps = async (
  text: string | undefined,
  location: any,
) => {
  try {
    if (isEmpty(text)) {
      return console.log(
        'getAddressFromAutoCompletemapmyindia Error: text is undefined.',
      );
    }

    let olaMapsResponse = await axios.get(
      `https://api.olamaps.io/places/v1/autocomplete?location=${location.latitude},${location.longitude}&input=${text}&api_key=${constants.OLA_MAPS_API_KEY}`,
    );

    // let mapmyindiaPlacesRes = await axios.get(
    //   `https://atlas.mappls.com/api/places/search/json?query=${text}`,
    //   {
    //     headers: {
    //       accept: 'application/json',
    //       Authorization: `${token_type} ${access_token}`,
    //     },
    //   },
    // );

    return olaMapsResponse;
  } catch (error) {
    console.log('getAddressFromAutoComplete error', error);
  }
};

const getCoordsFromAddress = async (address: string | undefined) => {
  try {
    // return dummy_destLocation
    if (isEmpty(address)) {
      return console.log('getCoordsFromAddress() Error: Address is undefined.');
    }
    // console.log('getCoordsFromAddress API:', address);
    const response = await axios.get(
      `https://maps.googleapis.com/maps/api/place/textsearch/json?key=${constants.GOOGLE_API_KEY}&query=${address}`,
    );
    const coords = [
      response?.data?.results[0]?.geometry?.location?.lng,
      response?.data?.results[0]?.geometry?.location?.lat,
    ];
    return coords;
  } catch (error) {
    console.log('getCoordsFromAddress error', error);
  }
};

const getAddressFromCoords = async (location: any) => {
  try {
    // return dummy_myAddress
    if (isEmpty(location)) {
      return console.log('getAddressFromCoords() Error: location is empty.');
    }
    console.log('getAddressFromCoords API:', location);
    const response = await axios.get(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${location.latitude},${location.longitude}&key=${constants.GOOGLE_API_KEY}`,
    );
    // console.log('responseeeeeeeeeee->', response.data?.results[0]);
    // console.log('responseeeeeeeeeee1->', JSON.stringify(response.data?.results));
    return response.data?.results[0]?.formatted_address;
  } catch (error) {
    console.log('getAddressFromCoords error:', error);
  }
};
const getAddressFromCoordsmapmyindia = async (location: any) => {
  try {
    // return dummy_myAddress
    if (isEmpty(location)) {
      return console.log('getAddressFromCoords() Error: location is empty.');
    }
    const response = await axios.get(
      `https://apis.mappls.com/advancedmaps/v1/ec436c7b83139376ccfd5a41f7dda279/rev_geocode?lat=${location.latitude}&lng=${location.longitude}&region=IND`,
      {
        headers: {
          accept: 'application/json',
          Authorization: `${token_type} ${access_token}`,
        },
      },
    );
    console.log('response--->', response.data?.results[0]?.formatted_address);
    return response.data?.results[0]?.formatted_address;
  } catch (error) {
    console.log('getAddressFromCoordsmapmyindia error:', error);
  }
};

const getDirections = async (location1: any, location2: any) => {
  try {
    // return { coords: dummy_Path, distance:dummy_distance, duration:dummy_duration };
    const resp = await axios.get(
      `https://maps.googleapis.com/maps/api/directions/json?origin=${location1.latitude},${location1.longitude}&destination=${location2.latitude},${location2.longitude}&key=${constants.GOOGLE_API_KEY}`,
    );
    const distance = {
      text: resp?.data.routes[0]['legs'][0]['distance']['text'],
      value: resp?.data.routes[0]['legs'][0]['distance']['value'],
    };
    const duration = {
      text: resp?.data.routes[0]['legs'][0]['duration']['text'],
      value: resp?.data.routes[0]['legs'][0]['duration']['value'],
    };
    const points = decode(resp?.data.routes[0].overview_polyline.points);
    const pathCoords = points.map((point: any[], index: any) => {
      return {
        latitude: point[0],
        longitude: point[1],
      };
    });
    return { coords: pathCoords, distance, duration };
  } catch (error) {
    console.log('getDirections error:', error);
  }
};
const getDirectionsmapmyindia = async (location1: any, location2: any) => {
  try {
    const resp: any = await axios.get(
      `https://apis.mappls.com/advancedmaps/v1/ec436c7b83139376ccfd5a41f7dda279/route_eta/driving/${location1.longitude}%2C${location1.latitude}%3B${location2.longitude}%2C${location2.latitude}?geometries=polyline&rtype=0&steps=true&exclude=ferry&region=IND&overview=simplified `,
      {
        headers: {
          accept: 'application/json',
          Authorization: `${token_type} ${access_token}`,
        },
      },
    );
    // console.log(' resp.data',  resp.data)
    const intersectionLocations = [];
    const distance = {
      text: `${(resp?.data.routes[0].distance / 1000).toFixed(1)} km`,
      value: resp?.data.routes[0].distance, //distance in km..
    };
    const duration = {
      text: `${Math.floor(resp?.data.routes[0].duration / 60)} minutes`,
      value: resp?.data.routes[0].duration / 60, //distance in minutes
    };
    // Iterate through the directionsData array
    for (const direction of resp.data.routes[0].legs[0].steps) {
      if (direction.intersections) {
        // Iterate through the intersections array for the current direction
        for (const intersection of direction.intersections) {
          if (intersection.location) {
            const [longitude, latitude] = intersection.location;
            intersectionLocations.push({ latitude, longitude });
          }
        }
      }
    }
    return { coords: intersectionLocations, distance, duration };
  } catch (error) {
    console.log('getDirectionsmapmyindia error:', error);
  }
};

export {
  getAddressFromAutoComplete,
  getAddressFromAutoCompleteOlaMaps,
  // getAddressFromAutoCompletemapmyindia,
  formatSocketResponse,
  getCoordsFromAddress,
  getAddressFromCoords,
  getAddressFromCoordsmapmyindia,
  getDirections,
  getDirectionsmapmyindia,
};
