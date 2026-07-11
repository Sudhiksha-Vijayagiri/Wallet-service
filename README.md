# Wallet Service

A backend financial service for wallet management and peer-to-peer money transfers.
Built as a backend engineering project to practice authentication, SQL transactions,
caching, and async messaging - not a real payment product, just for learning/demo purposes.

**Live demo (deployed on Render):** https://wallet-service-luud.onrender.com
**API docs (live):** https://wallet-service-luud.onrender.com/api-docs
**Run locally:** see Getting Started below - runs at http://localhost:3000 once started

Note: on the deployed version, transaction notifications (Kafka) don't run - more on
why in the [Deployment](#deployment) section below.
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
- Basic UI (plain HTML/CSS/JS, no framework) served at `/` - login, balance,
  deposit/withdraw, transfer, transaction history
- Jest + Supertest tests, plus a manual concurrency stress test script
- CI on every push via GitHub Actions (runs the test suite against real
  postgres + redis containers)
- Deployed on Render

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
├── public/               # basic UI (index.html), served by express.static
├── scripts/
│   └── concurrency-test.js   # manual load test for the locking logic
├── sql/
│   ├── schema.sql
│   └── seed.sql
├── tests/
├── .github/workflows/ci.yml  # github actions CI
├── docker-compose.yml
├── Dockerfile
└── package.json

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

### Testing it for real

Didn't want to just trust this by reading the code, so there's a script
(`scripts/concurrency-test.js`) that actually fires a bunch of transfer
requests at the same wallet at once and checks the math after.

Ran it with 30 concurrent requests, 10 each, starting balance 1000:
30 requests fired
20 succeeded, 10 failed (rate limiter kicked in - "too many transfer requests, slow down")
expected sender balance: 800
actual sender balance:   800
PASS - no lost updates

The 10 failures are the rate limiter doing its job (max 20 transfer requests/min
per IP), not a bug. The important part is the 20 that got through all hit the
locking logic at basically the same time and the balance still came out exact.
If the `FOR UPDATE` lock wasn't there, this is where you'd expect to see the
balance come out higher than 800 (some debit getting silently overwritten by
another request that read stale data).

Run it yourself with:
```bash
npm run test:concurrency
```
(server needs to be running already, in a separate terminal)

## Basic UI

Added a plain HTML/CSS/JS page at `/` so I could actually demo this without
opening Postman every time. No React or any frontend framework - didn't want
to change the tech stack just for a UI, and honestly four forms and a table
don't need one. It talks to the same `/api` routes as everything else, using
plain `fetch()`. Login, check balance, deposit, withdraw, transfer to another
user by email, and see transaction history.

## Deployment

Deployed on Render, connected directly to the GitHub repo so it redeploys on
every push to main.

This is the part that took way longer than I expected, mostly because I built
and tested everything locally with docker-compose, where postgres/redis/kafka
are all just containers on the same network talking to each other by name.
None of that infra exists automatically just because the app is deployed -
had to actually go set each piece up separately, and two of them didn't go
smoothly.

**Redis:** the app was crashing on Render right after starting, and the logs
were full of `redis connection error` followed by the whole process dying
with `MaxRetriesPerRequestError`. Took me a bit to realize the app was still
pointed at `localhost:6379` in production, which obviously doesn't exist on
Render - that's only valid on my own laptop where docker-compose runs redis
right next to the app. Fixed it two ways: first, actually created a **Render
Key Value** instance (that's their managed redis) and pointed `REDIS_HOST`
and `REDIS_PORT` env vars at it. Second, and probably more important - the
original redis config would let a connection failure crash the *entire app*,
not just the one request that needed redis. Rewrote it so redis failures
"fail open" instead: if redis is down, caching and rate limiting just get
skipped for that request instead of taking the whole server down. Caching
and rate limiting are nice-to-haves, they should never be the reason the
whole API goes offline.

**Kafka:** this one doesn't really have a clean fix. Render (as of when I
deployed this) just doesn't offer managed Kafka at all - it's on their
roadmap as a feature request, not an actual product you can spin up. So
`KAFKA_BROKER` on the deployed version has nowhere real to connect to.
Good news is the app was already built to handle this gracefully (this was
true even before I hit the deployment issue) - the kafka producer/consumer
calls are wrapped so a connection failure just logs an error and moves on,
it doesn't take down the transfer logic or crash the server. So on Render,
transfers/deposits/withdrawals all work completely normally, you just won't
see the `[notification] Email Sent -> ...` console log that shows up when
running locally with docker-compose, since there's no working kafka broker
for the event to actually reach a consumer through. Options if I wanted to
actually fix this properly: point `KAFKA_BROKER` at a free hosted kafka
(Upstash Kafka or similar) instead of Render's own infra, which would need
zero code changes, just an env var. Haven't done that yet since the
graceful-failure behavior is honestly a fine outcome for a demo deployment,
and arguably a better talking point than "everything requires 4 services to
be up or the whole thing breaks."

Basically: **postgres and redis are real and running on Render, kafka is
not, and the app was designed from the start to not fall over when a
downstream service like kafka isn't reachable.**

## Idempotency

Transfer requests can include an `Idempotency-Key` header. If the same key is
sent twice, the second request just returns the original transaction instead
of transferring the money again. This matters for real world clients that
retry on network timeouts.

## Notes / things not in scope

- No session/token blacklist table, logout is just handled client side
- Kafka is used for a single event type only, kept intentionally simple
- Kafka doesn't run on the deployed (Render) version, see Deployment section above
- UI is intentionally basic, no framework, no styling library