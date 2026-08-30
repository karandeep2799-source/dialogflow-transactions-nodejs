# Modern transaction backend

This branch replaces the 2018-era Firebase/Node 8 sample with a TypeScript service while keeping a thin Dialogflow/Actions-on-Google compatibility adapter.

## Architecture

- Node.js 20+
- TypeScript 5+
- Express 5 + Helmet + structured Pino logs
- PostgreSQL + Prisma
- Domain service for order creation/confirmation and idempotent confirmation
- Dialogflow webhook adapter isolated under `src/adapters`
- REST order API under `/v1/orders`
- Health endpoints for deployment probes
- Environment validation with Zod

## Run

```bash
cp .env.example .env
npm install
npx prisma generate
npx prisma migrate dev --name init
npm run dev
```

Webhook: `POST /dialogflow/webhook`

Health: `GET /health/live` and `GET /health/ready`

## Production notes

The original sample hard-coded customer data, order values, URLs, payment IDs and used `Math.random()` for order IDs. Those values are now generated/validated by the backend and persisted in PostgreSQL. Confirmation is performed inside a database transaction and repeated confirmations return the already-confirmed order.

The Google Assistant transaction protocol is retained only as an adapter because the source project is a legacy Actions-on-Google sample. Google documents the transaction lifecycle as requirements check -> delivery address -> transaction decision -> order update. Keep provider-specific payloads out of the core domain so the backend can later support another conversational channel or payment provider.
