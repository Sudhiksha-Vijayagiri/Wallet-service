const request = require('supertest');
const app = require('../src/app');
const pool = require('../src/config/db');
const redisClient = require("../src/config/redis");

const senderEmail = `sender_${Date.now()}@wallet.com`;
const receiverEmail = `receiver_${Date.now()}@wallet.com`;
let senderToken;

describe('Transaction routes', () => {
  beforeAll(async () => {
    await request(app).post('/api/auth/register').send({
      fullName: 'Sender',
      email: senderEmail,
      password: 'Password@123'
    });
    await request(app).post('/api/auth/register').send({
      fullName: 'Receiver',
      email: receiverEmail,
      password: 'Password@123'
    });

    const loginRes = await request(app).post('/api/auth/login').send({
      email: senderEmail,
      password: 'Password@123'
    });
    senderToken = loginRes.body.data.accessToken;

    // give sender some balance to work with
    await request(app)
      .post('/api/wallet/deposit')
      .set('Authorization', `Bearer ${senderToken}`)
      .send({ amount: 1000 });
  });

  afterAll(async () => {
  const walletResult = await pool.query(
    `
    SELECT w.id
    FROM wallets w
    JOIN users u ON w.user_id = u.id
    WHERE u.email IN ($1, $2)
    `,
    [senderEmail, receiverEmail]
  );

  const walletIds = walletResult.rows.map(r => r.id);

  if (walletIds.length > 0) {
    await pool.query(
      `
      DELETE FROM ledger_entries
      WHERE wallet_id = ANY($1::uuid[])
      `,
      [walletIds]
    );

    await pool.query(
      `
      DELETE FROM transactions
      WHERE sender_wallet_id = ANY($1::uuid[])
         OR receiver_wallet_id = ANY($1::uuid[])
      `,
      [walletIds]
    );
  }

  await pool.query(
    `
    DELETE FROM users
    WHERE email IN ($1, $2)
    `,
    [senderEmail, receiverEmail]
  );
  await redisClient.quit();
  await pool.end();
});

  it('should transfer money to another user', async () => {
    const res = await request(app)
      .post('/api/transactions/transfer')
      .set('Authorization', `Bearer ${senderToken}`)
      .send({ receiverEmail, amount: 100 });

    expect(res.statusCode).toBe(200);
    expect(res.body.data.amount).toBe('100.00');
  });

  it('should fail transfer to a non existent user', async () => {
    const res = await request(app)
      .post('/api/transactions/transfer')
      .set('Authorization', `Bearer ${senderToken}`)
      .send({ receiverEmail: 'doesnotexist@wallet.com', amount: 10 });

    expect(res.statusCode).toBe(404);
  });

  it('should not double process the same idempotency key', async () => {
    const key = `test-key-${Date.now()}`;

    const first = await request(app)
      .post('/api/transactions/transfer')
      .set('Authorization', `Bearer ${senderToken}`)
      .set('Idempotency-Key', key)
      .send({ receiverEmail, amount: 50 });

    const second = await request(app)
      .post('/api/transactions/transfer')
      .set('Authorization', `Bearer ${senderToken}`)
      .set('Idempotency-Key', key)
      .send({ receiverEmail, amount: 50 });

    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(200);
    // both requests should point to the exact same transaction id
    expect(second.body.data.id).toBe(first.body.data.id);
  });

  it('should return matching balance in reconciliation for sender wallet', async () => {
    const walletRes = await pool.query(
      `SELECT w.id FROM wallets w JOIN users u ON u.id = w.user_id WHERE u.email = $1`,
      [senderEmail]
    );
    const walletId = walletRes.rows[0].id;

    const result = await request(app).get(`/health`); // just making sure app is up before direct db check
    expect(result.statusCode).toBe(200);

    const { reconcileWallet } = require('../src/services/transaction.service');
    const reconciliation = await reconcileWallet(walletId);

    expect(reconciliation.matches).toBe(true);
  });
});
