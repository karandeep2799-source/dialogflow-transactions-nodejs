import { dialogflow, DeliveryAddress, OrderUpdate, SimpleResponse, Suggestions, TransactionDecision, TransactionRequirements } from 'actions-on-google';
import { createOrder, confirmOrder } from '../domain/orders.js';
import { env } from '../config.js';

export const app = dialogflow({ debug: false, ordersv3: true });

app.intent('Default Welcome Intent', (conv) => {
  conv.ask(new SimpleResponse({ speech: `Hi! I can help you place an order with ${env.MERCHANT_NAME}.`, text: `Hi! I can help you place an order with ${env.MERCHANT_NAME}.` }));
  conv.ask(new Suggestions(['start transaction']));
});

app.intent('Transaction Merchant', conv => conv.ask(new TransactionRequirements()));
app.intent('Transaction Google', conv => conv.ask(new TransactionRequirements()));

app.intent('Transaction Check Complete', conv => {
  const result: any = conv.arguments.get('TRANSACTION_REQUIREMENTS_CHECK_RESULT');
  if (result?.resultType !== 'CAN_TRANSACT') return conv.close('Transaction requirements were not met.');
  conv.ask('You can transact. I need your delivery address.');
  conv.ask(new Suggestions(['get delivery address']));
});

app.intent('Delivery Address', conv => conv.ask(new DeliveryAddress({ addressOptions: { reason: 'to know where to send your order' } })));

app.intent('Delivery Address Complete', (conv) => {
  const arg: any = conv.arguments.get('DELIVERY_ADDRESS_VALUE');
  if (arg?.userDecision !== 'ACCEPTED') return conv.close('I could not get your delivery address.');
  conv.data.location = arg.location;
  conv.ask('Thanks. I have your address. Say confirm transaction to review the order.');
  conv.ask(new Suggestions(['confirm transaction']));
});

app.intent('Transaction Decision', async (conv) => {
  const location = conv.data.location;
  const order = await createOrder({
    currency: 'USD',
    merchantId: env.MERCHANT_ID,
    merchantName: env.MERCHANT_NAME,
    termsUrl: env.MERCHANT_TERMS_URL,
    deliveryAddress: location,
    items: [{ id: 'memoirs_1', name: 'My Memoirs', unitMicros: 3_990_000n, quantity: 1 }],
  });
  conv.data.UNIQUE_ORDER_ID = order.merchantOrderId;
  conv.ask(new TransactionDecision({
    paymentParameters: conv.contexts.get('google_payment') ? { googlePaymentOption: { facilitationSpec: JSON.stringify({ environment: 'TEST', apiVersion: 2, apiVersionMinor: 0, merchantInfo: { merchantName: env.MERCHANT_NAME }, transactionInfo: { totalPriceStatus: 'FINAL', totalPrice: '3.99', currencyCode: 'USD' }, allowedPaymentMethods: [] }) } } : { merchantPaymentOption: { defaultMerchantPaymentMethodId: 'default' } },
    presentationOptions: { actionDisplayName: 'PLACE_ORDER' },
    orderOptions: { userInfoOptions: { userInfoProperties: ['EMAIL'] } },
    order: order.payload as any,
  }));
});

app.intent('Transaction Decision Complete', async (conv) => {
  const arg: any = conv.arguments.get('TRANSACTION_DECISION_VALUE');
  if (arg?.transactionDecision !== 'ORDER_ACCEPTED') return conv.close('Transaction was not completed.');
  const order = await confirmOrder(conv.data.UNIQUE_ORDER_ID, arg.order);
  const payload: any = order.payload;
  conv.ask(`Transaction completed! Your order ${order.merchantOrderId} is confirmed.`);
  conv.ask(new OrderUpdate({ type: 'SNAPSHOT', reason: 'Order confirmed', order: payload }));
});
