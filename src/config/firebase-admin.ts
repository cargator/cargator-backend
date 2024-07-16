import admin from 'firebase-admin';
// Define a type for the order data
interface Order {
  token: string; // Device token
  message: string; // Notification message
}

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: 'sukam-express',
    privateKey:
      '-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDGlZCF/8RKRhCl\nu6Ww9BBZZeXE2yc5BeWBtnYszBwXlbWWlM4d+/mJs7p9ZvF1hr6ClvsqzUk5Fbkt\nRICGW9sNx8EIk+ub6EbdlQgi7lXkQWJVZViMvoAzfpkj7q0VYYS0ZfgvGSdMb38X\nBQ3ZiDw+Yzr3uvlqTIRgkgKI+9SoIpKXzDYDaA8oHl89nzSNqvGCMft0lxKSpXki\n/VMJBMP8c5sr4f+rX/5AGnlqD1htukwkHsuQFYg91WIeaKPtwfgO4yJkrdwvQjmb\nN+E/ePowCTbNE0YqUDGzT6oPo2ZHJmcyAwrwghwUITkmjTIW+bZ2adkP5UhGvof7\ncrRxzQTfAgMBAAECggEALWw/kw72SKDvJOGfnDKvXKt8m4MfXSE2pm1kaYnEcTaa\nwxdFcEFXCkLUiOOXnnDUOc2sJNWxBoAsC6ksFs+C8wt6YWpoTZCbSQrSQh8vAVdd\nVTgpwYO/kkfGYpww9f+I2bSrSKahwQ+Ny+epi9ToJsMO1WRssX5QF0C+mLO1qEFc\nwHP7FDcELPHopbxVHUZO6KrdsPVmDVHPFLMsqnLzcmP/Sl2CXIgxlzSpMorCnxbs\nNzo84I8Ee93EGa6uHVAcEKAkXNaWJkTmZieKw8d1VacJKflFxIMPqPvcB6bjDjy7\nUPtUACu992Tmi84h3kndfFEbpayxOJ9YdpNfxcrsMQKBgQDzaXVFhbfOwnbn+lwz\nWUq2+Vl+rk87q9gPLIz/L7IHFZEec89zJDC7y1P/PpCvdODe7cB7d+77tFO/sxdl\njlMX0JvOUp/R9B0wDLYc6VVbLyvcsF9aEy8Y0n3YhoNnO/z2fRfDb2oO3OdKdZWB\nflfADnx70VFWg0lfraoqTCZfbwKBgQDQ2qFe/vsAZl621vlIpXs7ykgo0xqx6HPn\nbBb4zoc6MYxlgSnJmt++p2N/b1GW+8cA2mpeJw+fKYBE0YNEXfpKQZrucVkasAoI\n8xGT6pTTZ1t9SqRv92KafKsahkzSNF1sVvtd2aUkuHZhEG+n+2NEMwcxzZQ1+5CH\n+1YHd6L5kQKBgAawajmb4B49d9kOJ0R9+rCmj5AMqD7CjTB1j/ZfUCwjqpZEpnnK\nj9BJWSiVhpJbyuY1cGm0NQwTu410FXuD+sKXyABWgu/ZHog4gTSwMNlNpY3uBuDJ\n0CyFdFHj+G541o3LiEClqit4ZJ7GNnKVj0HG5CLe8LZI61ZGxntdFlzfAoGBAJ36\nAb39WJbA2Dus9/p/UWu0YkifBb40ehc+p1Gjxp26BNxyis04HK31p0kpRqnR4IFA\ntNxq52IY3jEv2P7Jpxyr6ykZC7EoHy8NzOn5soEF2So4X5Fhqm/4hOQXWdxWR6Q/\nVvtyOXxBGynoaMzDVh6sCnEdc1Ix6u0wq64STHBBAoGBAOl/kzPFAkzD9i75wQsv\nFNg3DcFzTc8dNnTvediDadG19G+INJz6PBjiQflZVGx9/XNWitt6zmaGi6O0tBcc\nfKvyF6sI6KjncJyt0+68IYLpajg54QjwEA5BDxEH3bo9b4e7Z9w4LaskDvLatH0N\nIKL4If8kVH8IOc89G9O37lAP\n-----END PRIVATE KEY-----\n',
    clientEmail:
      'firebase-adminsdk-pl0wj@sukam-express.iam.gserviceaccount.com',
  }),
});

// Function to send a notification
export async function sendOrderNotification(order: Order) {
  const payload = {
    notification: {
      title: 'New Order Received',
      body: order.message,
    },
  };

  try {
    await admin.messaging().sendToDevice(order.token, payload);
    console.log('Notification sent successfully');
  } catch (error) {
    console.error('Error sending notification:', error);
  }
}

export default admin;
