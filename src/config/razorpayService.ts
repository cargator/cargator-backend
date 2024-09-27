import Razorpay from 'razorpay';
import crypto from 'crypto';
import environmentVars from '../constantsVars';

const razorpay = new Razorpay({
  key_id: environmentVars.DEV_RAZORPAY_KEY_ID || '',
  key_secret: environmentVars.DEV_RAZORPAY_KEY_SECRET || '',
});

/**
 * Verifies Razorpay data using HMAC SHA256.
 * @param body - The request body.
 * @param razorpaySignature - The Razorpay signature to verify.
 * @returns A boolean indicating whether the signature is valid.
 */
export async function verifyRazorpayData(
  body: any,
  razorpaySignature: string,
): Promise<boolean> {
  const secretKey = environmentVars.DEV_RAZORPAY_KEY_SECRET;
  const hmac = crypto.createHmac('sha256', secretKey);
  hmac.update(JSON.stringify(body));
  const digest = hmac.digest('hex');
  return digest === razorpaySignature;
}

export default razorpay;
