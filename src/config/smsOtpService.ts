import axios from 'axios';
import environmentVars from '../constantsVars';

export async function sendOtpViaSms(mobileNumber: string, otp: string) {
  try {
    const response = await axios.get(`https://api.authkey.io/request`, {
      params: {
        authkey: environmentVars.AUTHKEY_OTP,
        mobile: mobileNumber,
        country_code: '91',
        sid: environmentVars.OTP_SID,
        otp: otp,
      },
    });
    return response;
  } catch (error) {
    console.error('Error sending OTP via SMS:', error);
    throw error;
  }
}
