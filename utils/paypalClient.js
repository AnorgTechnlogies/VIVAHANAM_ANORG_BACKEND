import paypal from '@paypal/checkout-server-sdk';

// PayPal environment setup
const createPayPalClient = () => {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  
  console.log('🔍 PayPal Client ID exists:', !!clientId);
  console.log('🔍 PayPal Client Secret exists:', !!clientSecret);
  
  if (!clientId || !clientSecret) {
    console.error('❌ PayPal credentials missing. Check your .env file.');
    throw new Error('PayPal credentials not configured');
  }

  let environment;
  if (process.env.NODE_ENV === 'production') {
    console.log('🔍 Using PayPal LIVE environment');
    environment = new paypal.core.LiveEnvironment(clientId, clientSecret);
  } else {
    console.log('🔍 Using PayPal SANDBOX environment');
    environment = new paypal.core.SandboxEnvironment(clientId, clientSecret);
  }

  return new paypal.core.PayPalHttpClient(environment);
};

// Create and export the client instance
export const client = createPayPalClient();

/**
 * Create PayPal order
 */
export const createOrder = async (amount, currency = 'USD', customId = '') => {
  try {
    const request = new paypal.orders.OrdersCreateRequest();
    request.prefer('return=representation');
    
    request.requestBody({
      intent: 'CAPTURE',
      purchase_units: [{
        amount: {
          currency_code: currency,
          value: amount.toString(),
        },
        custom_id: customId,
      }],
    });

    const response = await client.execute(request);
    return response.result;
  } catch (error) {
    console.error('PayPal create order error:', error);
    throw new Error('Failed to create PayPal order: ' + error.message);
  }
};

/**
 * Capture PayPal payment
 */
export const captureOrder = async (orderID) => {
  try {
    const request = new paypal.orders.OrdersCaptureRequest(orderID);
    request.requestBody({});

    const response = await client.execute(request);
    return response.result;
  } catch (error) {
    console.error('PayPal capture order error:', error);
    throw new Error('Failed to capture PayPal order: ' + error.message);
  }
};