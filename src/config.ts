import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  PORT: z.coerce.number().int().positive().default(8080),
  DATABASE_URL: z.string().min(1),
  LOG_LEVEL: z.string().default('info'),
  MERCHANT_ID: z.string().min(1),
  MERCHANT_NAME: z.string().min(1),
  MERCHANT_TERMS_URL: z.string().url(),
  DIALOGFLOW_WEBHOOK_TOKEN: z.string().optional(),
});

export const env = schema.parse(process.env);
