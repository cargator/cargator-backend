import admin from 'firebase-admin';
import environmentVars from '../constantsVars';
// Define a type for the order data
interface Order {
  token: string; // Device token
  message: string; // Notification message
}

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: environmentVars.PROJECT_ID,
    privateKey: environmentVars.PRIVATE_KEY,
    clientEmail: environmentVars.CLIENT_EMAIL,
  }),
});

// Function to send a notification
export async function sendOrderNotification(
  deviceToken: string,
  newOrder: any,
) {
  const payload = {
    notification: {
      title: 'New Order Received',
    },
    data: {
      data: JSON.stringify(newOrder),
    },
  };

  try {
    await admin.messaging().send({
      token: deviceToken,
      notification: payload.notification,
      data: payload.data,
    });
    console.log('Notification sent successfully to token:', deviceToken);
  } catch (error) {
    console.error(`Error sending notification to token ${deviceToken}:`, error);
  }
}

export default admin;
