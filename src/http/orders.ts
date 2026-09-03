import { Router } from 'express';
import { prisma } from '../domain/orders.js';

export const ordersRouter = Router();

ordersRouter.get('/:merchantOrderId', async (req, res, next) => {
  try {
    const order = await prisma.order.findUnique({ where: { merchantOrderId: req.params.merchantOrderId }, include: { events: true } });
    if (!order) return res.status(404).json({ error: 'ORDER_NOT_FOUND' });
    return res.json(order);
  } catch (err) { next(err); }
});

ordersRouter.post('/:merchantOrderId/cancel', async (req, res, next) => {
  try {
    const order = await prisma.order.findUnique({ where: { merchantOrderId: req.params.merchantOrderId } });
    if (!order) return res.status(404).json({ error: 'ORDER_NOT_FOUND' });
    const updated = await prisma.order.update({ where: { id: order.id }, data: { status: 'CANCELLED', events: { create: { type: 'ORDER_CANCELLED', payload: req.body ?? {} } } } });
    return res.json(updated);
  } catch (err) { next(err); }
});
