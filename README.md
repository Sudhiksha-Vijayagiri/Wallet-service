# Wallet Service

A backend financial service for wallet management and peer-to-peer money transfers.
Built as a backend engineering project to practice authentication, SQL transactions,
caching, and async messaging - not a real payment product, just for learning/demo purposes.

## Features

- JWT based authentication (access + refresh tokens)
- Wallet balance, deposit, withdraw
- P2P money transfer with:
  - row-level locking to handle concurrent transfers safely
  - idempotency key support so retried requests don't double-charge
  - double entry ledger (every transfer creates a DEBIT + CREDIT entry)
- Redis caching for balance reads + rate limiting on auth/transfer routes
- Kafka event published on every completed transaction, consumed by a
  notification "service" that just logs to console (no real email sending)
- Swagger docs for all endpoints
- Jest + Supertest tests

## Tech stack and why

| Tech | Why it's here |
|---|---|
| Express | simple, well known REST framework, no need for anything heavier for this scope |
| PostgreSQL | need real ACID transactions, a transfer touches 2 wallets + 2 ledger rows and all of it needs to succeed or fail together |
| JWT | stateless auth, no session store needed |
| bcrypt | slow hashing so passwords can't be brute forced easily |
| Redis | (1) cache wallet balance so we're not hitting postgres on every read (2) rate limiting auth/transfer endpoints |
| Kafka | decouples sending a notification from the actual money transfer - if notification consumer is down, transfers still work |
| Swagger | auto generated docs from code comments |
| Jest/Supertest | unit + integration testing |
| Docker Compose | spins up postgres/redis/kafka locally without installing them manually |

## Project structure

```
wallet-service/
├── src/
│   ├── config/         # db, redis, kafka, swagger setup
│   ├── controllers/     # handles req/res, calls services
│   ├── services/        # business logic lives here
│   ├── routes/          # express routers + swagger jsdoc
│   ├── middleware/       # auth, error handling, rate limiting
│   ├── utils/            # jwt, password hashing, error class, etc
│   ├── app.js
│   └── server.js
├── sql/
│   ├── schema.sql
│   └── seed.sql
├── tests/
├── docker-compose.yml
├── Dockerfile
└── package.json
```

## Getting started

1. Copy `.env.example` to `.env` and fill in values (defaults work with docker-compose).

2. Start the infra (postgres, redis, kafka, zookeeper):

```bash
docker compose up -d
```

3. Install deps:

```bash
npm install
```

4. Run the schema + seed data against postgres:

```bash
psql -h localhost -U wallet_user -d wallet_service -f sql/schema.sql
psql -h localhost -U wallet_user -d wallet_service -f sql/seed.sql
```

5. Start the app:

```bash
npm run dev
```

6. Docs are at `http://localhost:3000/api-docs`

## Testing

```bash
npm test
```

Note: tests hit an actual postgres instance so make sure docker-compose is up
and the schema has been applied first.

## Database design

Instead of just storing a `balance` column and blindly updating it, every
transfer/deposit/withdraw writes to a `ledger_entries` table too (DEBIT/CREDIT).
This means the balance can always be double-checked by summing the ledger,
which is closer to how real financial systems work. There's an admin endpoint
(`/admin/reconcile/:walletId`) that checks this for a given wallet.

## Concurrency handling

If two transfer requests hit the same wallet at the same time, we don't want
a lost update (e.g. two withdrawals both reading balance=100 and both
succeeding when only one should). The transfer logic locks both wallet rows
with `SELECT ... FOR UPDATE` inside a DB transaction, and always locks in a
consistent order (sorted by wallet id) so two transfers going in opposite
directions between the same two wallets can't deadlock each other.

## Idempotency

Transfer requests can include an `Idempotency-Key` header. If the same key is
sent twice, the second request just returns the original transaction instead
of transferring the money again. This matters for real world clients that
retry on network timeouts.

## Notes / things not in scope

- No UI yet, this is API only for now (basic UI planned later, separate from this repo's tech stack)
- No session/token blacklist table, logout is just handled client side
- Kafka is used for a single event type only, kept intentionally simple
