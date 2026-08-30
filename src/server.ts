import express from 'express';
import helmet from 'helmet';
import pino from 'pino';
import pinoHttp from 'pino-http';
import { env } from './config.js';
import { app as dialogflowApp } from './adapters/dialogflow.js';
import { ordersRouter } from './http/orders.js';

export const logger = pino({ level: env.LOG_LEVEL });
export const server = express();
server.disable('x-powered-by');
server.use(helmet());
server.use(express.json({ limit: '1mb' }));
server.use(pinoHttp({ logger }));

server.get('/health/live', (_req, res) => res.json({ status: 'ok' }));
server.get('/health/ready', (_req, res) => res.json({ status: 'ok' }));
server.use('/v1/orders', ordersRouter);
server.post('/dialogflow/webhook', (req, res, next) => {
  if (env.DIALOGFLOW_WEBHOOK_TOKEN && req.get('authorization') !== `Bearer ${env.DIALOGFLOW_WEBHOOK_TOKEN}`) return res.status(401).json({ error: 'UNAUTHORIZED' });
  return dialogflowApp(req, res, next);
});
server.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error({ err }, 'request failed');
  res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
});

if (process.env.NODE_ENV !== 'test') server.listen(env.PORT, () => logger.info({ port: env.PORT }, 'transaction backend listening'));
