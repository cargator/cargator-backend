import admin from 'firebase-admin';
import serviceAccount from './../google-services.json'; // Adjust the path
// Define a type for the order data
interface Order {
  token: string; // Device token
  message: string; // Notification message
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
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
