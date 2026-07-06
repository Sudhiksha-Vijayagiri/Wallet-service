const request = require('supertest');
const app = require('../src/app');
const pool = require('../src/config/db');

const testEmail = `wallet_test_${Date.now()}@wallet.com`;
let accessToken;

describe('Wallet routes', () => {
  beforeAll(async () => {
    await request(app).post('/api/auth/register').send({
      fullName: 'Wallet Test User',
      email: testEmail,
      password: 'Password@123'
    });

    const loginRes = await request(app).post('/api/auth/login').send({
      email: testEmail,
      password: 'Password@123'
    });

    accessToken = loginRes.body.data.accessToken;
  });

  afterAll(async () => {
  // Find the wallet belonging to the test user
  const walletResult = await pool.query(
    `
    SELECT w.id
    FROM wallets w
    JOIN users u ON w.user_id = u.id
    WHERE u.email = $1
    `,
    [testEmail]
  );
  if (walletResult.rows.length > 0) {
    const walletId = walletResult.rows[0].id;
    await pool.query(
      `
      DELETE FROM ledger_entries
      WHERE wallet_id = $1
      `,
      [walletId]
    );
    await pool.query(
      `
      DELETE FROM transactions
      WHERE sender_wallet_id = $1
         OR receiver_wallet_id = $1
      `,
      [walletId]
    );
  }
  await pool.query(
    `DELETE FROM users WHERE email = $1`,
    [testEmail]
  );

  await pool.end();
});

  it('should get balance as 0 for new user', async () => {
    const res = await request(app)
      .get('/api/wallet/balance')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.balance).toBe(0);
  });

  it('should deposit money successfully', async () => {
    const res = await request(app)
      .post('/api/wallet/deposit')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ amount: 500 });

    expect(res.statusCode).toBe(200);
    expect(res.body.data.balance).toBe(500);
  });

  it('should not allow withdrawing more than balance', async () => {
    const res = await request(app)
      .post('/api/wallet/withdraw')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ amount: 99999 });

    expect(res.statusCode).toBe(400);
  });

  it('should withdraw money successfully within balance', async () => {
    const res = await request(app)
      .post('/api/wallet/withdraw')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ amount: 200 });

    expect(res.statusCode).toBe(200);
    expect(res.body.data.balance).toBe(300);
  });
});
