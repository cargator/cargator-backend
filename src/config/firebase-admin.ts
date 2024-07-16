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
      '-----BEGIN PRIVATE KEY-----\nMIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQC8OM6k6n5cfTfX\nsmEMjhx5U1AQ6boTipz/Z9qEzrZoQMEe/ivSPdH4QtiAxwjj7WhsG5ik7Dn8jVEN\nu9jNTjjfkT3uPOMYloyF0RWpbosXijiJSl3ENJt5Hr8DyZyeigdxuLFmasmskX5t\n208/weyf/9bvaGhq3IMOCXRhZJXZlLjMNCzYepQKotk4jfd2+f+4eUX0MVKBrYdx\nSJMp1WVGBOdd1dTXFZfuiHZucADoBCzOPlQrdUTTvOK++DjXRXX/m7HLpmnZjmQd\n1n9hykZ2bLU6cKdXbNCrLh2JwHbsg2qlO7JU2jq5vGdCoJu0w1DEqDXJ8bCNXyGK\nsAAGQw0nAgMBAAECggEABDCzkQJTa9Wxz5B+Dpx/T8gmCSpa5SJ52knCmKBNeUav\nxfPcn+KWcRNz5HIJ5aEcaQO4QzurEs9Glaqv6eoq4/dEzK/4UkzPtg7wj4QRfqWq\nGoxYSAzvxSOFFx1+6hyii8qT0HbiJIBcsy9ltUKo9OrqKwxE/tQH6uEVATIPD/fw\n2dw8TXzRgTOOLSyvMh2db37mGsl6NYj7NqLDHyR5U0UVuKX8UCr0r9jQgeJDnJEV\n4H1NzmQPxHsv6SEbwQ795M8K51MBIiV4wQgkSmECZVjDNi80oq5/ro65YV5he9al\n15PtuWOzDqQ++3bP+L9wJESntU9gslz9HKOIEwEx0QKBgQDixhc+yeMDiDjz+X6+\nO/irqXqidMhXbh5boQvRfE4BPh4mGcK94PfYtmaWYDXWETUmhshxDXPV5mtDNCXm\n+US3VTkpGdU/6Pjxc0vWQkXvCqAlaT9qHyNrvSe2H3JsQRIaiybWI9q3vxYzi2wQ\n/XMUDOjCEAWE4qO+5qgTRK6f7wKBgQDUesfNS0fn4uhWd5U2SF+haw3Mb4Qtm4Jo\nEHX/+9suCIgBtR+60QvgEL2ftrYh65ECJIL+t+jXO2hdVlrZpV+AwyLkOMOSqh35\nrx84j2jVVz389tf104wuhsggKUAH0uYNNgUw4lEF/WdG5FXNpP5QxaUjBQFmfgtQ\nG2h6yW2uSQKBgEQ7hC0BQ8wBRdmq3UbR9p14Dg0phEpCOOIrD8pFU5cuIJYoNB87\nvHc5Up62bhxt6wcfkNnrSUo33VhILYtUvydGfj9upWpoZ9cGcPAT2sT09oCrLUh5\n/Adjz7oNtjj6Tz8rVVEjUqDs3vo9XhOyntiOlc4mUfLM2qYK8tFxXfWDAoGAHUbF\nnO3QfIzxQmi7sH0MYCtl/VMoPTh+IWSTPbAwJQmb49BXDOCc6ESmPAlq0wWoN0lc\nm0gv1ugimym43uBAZnd8qUGBAQZblvmgLaTk5vBcZCyG2SJK4GZF0NieL/XJKOzW\njkPAsjiWMFhp0in3uJ1jAY5BASRA3srH/JMgf7ECgYBB3cpeDYdDCgBh+s9v4k2t\nFjNIYou+dgm1DnxRYxgwcii90Ssm/QRa+5kp0Xb1OFHq8iSBWB+Vh4qQVSUblG2x\nI2NTionmkipiSfrCKoz4VochBUjlhFv5uobPT/NP8tQjKcA8vSEb2V5FW8LYyyzo\nAZP8YUNWFFyG3hhOELu+IA==\n-----END PRIVATE KEY-----\n',
    clientEmail:
      'firebase-adminsdk-rf74m@financial-literacy-mobile-app.iam.gserviceaccount.com',
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
