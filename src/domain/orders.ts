import { PrismaClient, OrderStatus } from '@prisma/client';
import crypto from 'node:crypto';

export const prisma = new PrismaClient();

export type CartItem = { id: string; name: string; unitMicros: bigint; quantity: number };

export function buildOrder(input: { items: CartItem[]; currency: string; deliveryAddress?: unknown; merchantId: string; merchantName: string; termsUrl: string }) {
  const subtotal = input.items.reduce((sum, i) => sum + i.unitMicros * BigInt(i.quantity), 0n);
  const delivery = 2_000_000n;
  const tax = 0n;
  const total = subtotal + delivery + tax;
  const id = crypto.randomUUID();
  const lineItems = input.items.map(i => ({ id: i.id, name: i.name, quantity: i.quantity, priceMicros: i.unitMicros.toString() }));
  const payload = {
    merchantOrderId: id,
    userVisibleOrderId: id,
    transactionMerchant: { id: input.merchantId, name: input.merchantName },
    contents: { lineItems },
    priceAttributes: [
      { type: 'SUBTOTAL', name: 'Subtotal', state: 'ACTUAL', amount: { currencyCode: input.currency, amountInMicros: Number(subtotal) }, taxIncluded: true },
      { type: 'DELIVERY', name: 'Delivery', state: 'ACTUAL', amount: { currencyCode: input.currency, amountInMicros: Number(delivery) }, taxIncluded: true },
      { type: 'TAX', name: 'Tax', state: 'ACTUAL', amount: { currencyCode: input.currency, amountInMicros: Number(tax) }, taxIncluded: true },
      { type: 'TOTAL', name: 'Total Price', state: 'ACTUAL', amount: { currencyCode: input.currency, amountInMicros: Number(total) }, taxIncluded: true },
    ],
    termsOfServiceUrl: input.termsUrl,
    purchase: { status: 'CREATED', userVisibleStatusLabel: 'Order created', type: 'RETAIL', fulfillmentInfo: { fulfillmentType: 'DELIVERY', location: input.deliveryAddress } },
  };
  return { id, total, payload };
}

export async function createOrder(input: Parameters<typeof buildOrder>[0]) {
  const built = buildOrder(input);
  return prisma.order.create({ data: {
    merchantOrderId: built.id,
    userVisibleOrderId: built.id,
    status: OrderStatus.CREATED,
    currency: input.currency,
    totalMicros: built.total,
    payload: built.payload,
    deliveryAddress: input.deliveryAddress as any,
    events: { create: { type: 'ORDER_CREATED', payload: built.payload } },
  }});
}

export async function confirmOrder(merchantOrderId: string, orderPayload: any) {
  return prisma.$transaction(async tx => {
    const order = await tx.order.findUnique({ where: { merchantOrderId } });
    if (!order) throw new Error('ORDER_NOT_FOUND');
    if (order.status === OrderStatus.CONFIRMED) return order;
    if (order.status !== OrderStatus.CREATED) throw new Error(`INVALID_ORDER_STATE:${order.status}`);
    const payload = { ...orderPayload, lastUpdateTime: new Date().toISOString(), purchase: { ...(orderPayload.purchase ?? {}), status: 'CONFIRMED', userVisibleStatusLabel: 'Order confirmed' } };
    const updated = await tx.order.update({ where: { id: order.id }, data: { status: OrderStatus.CONFIRMED, payload } });
    await tx.orderEvent.create({ data: { orderId: order.id, type: 'ORDER_CONFIRMED', payload } });
    return updated;
  });
}
