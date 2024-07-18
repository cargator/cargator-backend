import nodemailer from 'nodemailer';
import environmentVars from '../constantsVars';

interface MailOptions {
  from: string;
  to: string[];
  subject: string;
  text?: string;
  html?: string;
}

const generateEmailHtml = (order: {
  drop_details: {
    name: any;
    address: any;
    city: any;
    contact_number: any;
    latitude: any;
    longitude: any;
  };
  order_details: {
    customer_orderId: any;
    order_source: any;
    order_total: any;
    paid: any;
    vendor_order_id: any;
  };
  order_items: any[];
  pickup_details: {
    name: any;
    address: any;
    city: any;
    contact_number: any;
    latitude: any;
    longitude: any;
  };
}) => `
  <div style="font-family: Arial, sans-serif; margin: 20px; max-width: 600px;">
    <h2 style="background-color: #4CAF50; color: white; padding: 10px; border-radius: 4px; text-align: center;">Order Received</h2>
    
    <div style="margin-bottom: 20px;">
      <h3 style="color: #333; border-bottom: 1px solid #ddd; padding-bottom: 5px;">Drop Details</h3>
      <p><strong>Name:</strong> ${order.drop_details.name}</p>
      <p><strong>Address:</strong> ${order.drop_details.address}</p>
      <p><strong>City:</strong> ${order.drop_details.city}</p>
      <p><strong>Contact Number:</strong> ${
        order.drop_details.contact_number
      }</p>
      <p><strong>Latitude:</strong> ${order.drop_details.latitude}</p>
      <p><strong>Longitude:</strong> ${order.drop_details.longitude}</p>
    </div>
    
    <div style="margin-bottom: 20px;">
      <h3 style="color: #333; border-bottom: 1px solid #ddd; padding-bottom: 5px;">Order Details</h3>
      <p><strong>Customer Order ID:</strong> ${
        order.order_details.customer_orderId
      }</p>
      <p><strong>Order Source:</strong> ${order.order_details.order_source}</p>
      <p><strong>Order Total:</strong> ${order.order_details.order_total}</p>
      <p><strong>Paid:</strong> ${order.order_details.paid}</p>
      <p><strong>Vendor Order ID:</strong> ${
        order.order_details.vendor_order_id
      }</p>
    </div>
    
    <div style="margin-bottom: 20px;">
      <h3 style="color: #333; border-bottom: 1px solid #ddd; padding-bottom: 5px;">Order Items</h3>
      ${order.order_items
        .map(
          (item) => `
        <div style="padding: 10px; background-color: #fff; border: 1px solid #ddd; border-radius: 4px; margin-bottom: 10px;">
          <p><strong>ID:</strong> ${item.id}</p>
          <p><strong>Name:</strong> ${item.name}</p>
          <p><strong>Price:</strong> ${item.price}</p>
          <p><strong>Quantity:</strong> ${item.quantity}</p>
        </div>
      `,
        )
        .join('')}
    </div>
    
    <div style="margin-bottom: 20px;">
      <h3 style="color: #333; border-bottom: 1px solid #ddd; padding-bottom: 5px;">Pickup Details</h3>
      <p><strong>Name:</strong> ${order.pickup_details.name}</p>
      <p><strong>Address:</strong> ${order.pickup_details.address}</p>
      <p><strong>City:</strong> ${order.pickup_details.city}</p>
      <p><strong>Contact Number:</strong> ${
        order.pickup_details.contact_number
      }</p>
      <p><strong>Latitude:</strong> ${order.pickup_details.latitude}</p>
      <p><strong>Longitude:</strong> ${order.pickup_details.longitude}</p>
    </div>
  </div>
`;

// Create a transporter object
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: environmentVars.EMAIL_USER,
    pass: environmentVars.EMAIL_PASS,
  },
});

transporter.verify((error, success) => {
  if (error) {
    console.error(error);
  } else {
    console.log("success ===> ",success);
    
    console.log('Server is ready to take our messages');
  }
});

// Send an email
export async function sendEmail(orderData: any) {
  try {
    const mailOptions: MailOptions = {
      from: 'noreply@gmail.com',
      to: [
        // 'manish@cargator.org',
        // 'Kanav@crepe-fe.com',
        // 'kuldeep.mane@code-b.dev',
        "9nath.parte@gmail.com"
      ],
      subject: 'New Order Received',
      text: 'A new order has been received.',
      html: generateEmailHtml(orderData),
    };
    const info = await transporter.sendMail(mailOptions);
    console.log('Message sent: %s', info.messageId);
    console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));

  } catch (error) {
    console.error('Error sending email:', error);
  }
}
