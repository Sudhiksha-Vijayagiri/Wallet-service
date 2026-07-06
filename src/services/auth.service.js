const pool = require('../config/db');
const { hashPassword, comparePassword } = require('../utils/password');
const { generateAccessToken, generateRefreshToken, verifyRefreshToken } = require('../utils/jwt');
const ApiError = require('../utils/ApiError');

async function registerUser({ fullName, email, password }) {
  const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);

  if (existing.rows.length > 0) {
    throw new ApiError(409, 'a user with this email already exists');
  }

  const passwordHash = await hashPassword(password);

  const result = await pool.query(
    `INSERT INTO users (full_name, email, password_hash)
     VALUES ($1, $2, $3)
     RETURNING id, full_name, email, role, created_at`,
    [fullName, email, passwordHash]
  );

  const user = result.rows[0];

  // every new user gets a wallet automatically, don't want a "create wallet"
  // step as a separate manual thing
  await pool.query('INSERT INTO wallets (user_id, balance) VALUES ($1, 0)', [user.id]);

  return user;
}

async function loginUser({ email, password }) {
  const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
  const user = result.rows[0];

  if (!user) {
    throw new ApiError(401, 'invalid email or password');
  }

  const isMatch = await comparePassword(password, user.password_hash);
  if (!isMatch) {
    throw new ApiError(401, 'invalid email or password');
  }

  const payload = { id: user.id, email: user.email, role: user.role };
  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken(payload);

  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      fullName: user.full_name,
      email: user.email,
      role: user.role
    }
  };
}

async function refreshAccessToken(refreshToken) {
  if (!refreshToken) {
    throw new ApiError(401, 'refresh token required');
  }

  let decoded;
  try {
    decoded = verifyRefreshToken(refreshToken);
  } catch (err) {
    throw new ApiError(401, 'invalid or expired refresh token');
  }

  const payload = { id: decoded.id, email: decoded.email, role: decoded.role };
  const newAccessToken = generateAccessToken(payload);

  return { accessToken: newAccessToken };
}

module.exports = { registerUser, loginUser, refreshAccessToken };
