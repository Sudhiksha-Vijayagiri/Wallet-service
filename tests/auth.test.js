const request = require('supertest');
const app = require('../src/app');
const pool = require('../src/config/db');

// using a random-ish email each run so tests don't collide with old data
const testEmail = `test_${Date.now()}@wallet.com`;

describe('Auth routes', () => {
  afterAll(async () => {
    // cleanup so we don't leave junk users in the db after test run
    await pool.query('DELETE FROM users WHERE email = $1', [testEmail]);
    await pool.end();
  });

  it('should register a new user', async () => {
    const res = await request(app).post('/api/auth/register').send({
      fullName: 'Test User',
      email: testEmail,
      password: 'Password@123'
    });

    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.email).toBe(testEmail);
  });

  it('should not register the same email twice', async () => {
    const res = await request(app).post('/api/auth/register').send({
      fullName: 'Test User',
      email: testEmail,
      password: 'Password@123'
    });

    expect(res.statusCode).toBe(409);
  });

  it('should login with correct credentials', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: testEmail,
      password: 'Password@123'
    });

    expect(res.statusCode).toBe(200);
    expect(res.body.data.accessToken).toBeDefined();
  });

  it('should reject login with wrong password', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: testEmail,
      password: 'wrongPassword'
    });

    expect(res.statusCode).toBe(401);
  });
});
