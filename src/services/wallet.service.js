const pool = require('../config/db');
const ApiError = require('../utils/ApiError');
const redisService = require('./redis.service');

async function getWalletByUserId(userId) {
  const result = await pool.query('SELECT * FROM wallets WHERE user_id = $1', [userId]);
  if (result.rows.length === 0) {
    throw new ApiError(404, 'wallet not found for this user');
  }
  return result.rows[0];
}

async function getBalance(userId) {
  const wallet = await getWalletByUserId(userId);

  // try cache first before going to postgres
  const cached = await redisService.getCachedBalance(wallet.id);
  if (cached !== null) {
    return { balance: cached, cached: true };
  }

  await redisService.setCachedBalance(wallet.id, wallet.balance);
  return { balance: parseFloat(wallet.balance), cached: false };
}

// deposit and withdraw both go through the ledger too, keeping the same
// accounting logic everywhere instead of just doing balance +/-
async function deposit(userId, amount) {
  if (amount <= 0) {
    throw new ApiError(400, 'deposit amount must be greater than 0');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const walletResult = await client.query(
      'SELECT * FROM wallets WHERE user_id = $1 FOR UPDATE',
      [userId]
    );
    const wallet = walletResult.rows[0];
    if (!wallet) {
      throw new ApiError(404, 'wallet not found');
    }

    const txnResult = await client.query(
      `INSERT INTO transactions (receiver_wallet_id, amount, status)
       VALUES ($1, $2, 'completed') RETURNING id`,
      [wallet.id, amount]
    );
    const transactionId = txnResult.rows[0].id;

    await client.query(
      `INSERT INTO ledger_entries (transaction_id, wallet_id, entry_type, amount)
       VALUES ($1, $2, 'CREDIT', $3)`,
      [transactionId, wallet.id, amount]
    );

    const updated = await client.query(
      'UPDATE wallets SET balance = balance + $1 WHERE id = $2 RETURNING balance',
      [amount, wallet.id]
    );

    await client.query('COMMIT');

    await redisService.invalidateBalance(wallet.id);

    return { balance: parseFloat(updated.rows[0].balance), transactionId };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function withdraw(userId, amount) {
  if (amount <= 0) {
    throw new ApiError(400, 'withdraw amount must be greater than 0');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const walletResult = await client.query(
      'SELECT * FROM wallets WHERE user_id = $1 FOR UPDATE',
      [userId]
    );
    const wallet = walletResult.rows[0];
    if (!wallet) {
      throw new ApiError(404, 'wallet not found');
    }

    if (parseFloat(wallet.balance) < amount) {
      throw new ApiError(400, 'insufficient balance');
    }

    const txnResult = await client.query(
      `INSERT INTO transactions (sender_wallet_id, amount, status)
       VALUES ($1, $2, 'completed') RETURNING id`,
      [wallet.id, amount]
    );
    const transactionId = txnResult.rows[0].id;

    await client.query(
      `INSERT INTO ledger_entries (transaction_id, wallet_id, entry_type, amount)
       VALUES ($1, $2, 'DEBIT', $3)`,
      [transactionId, wallet.id, amount]
    );

    const updated = await client.query(
      'UPDATE wallets SET balance = balance - $1 WHERE id = $2 RETURNING balance',
      [amount, wallet.id]
    );

    await client.query('COMMIT');

    await redisService.invalidateBalance(wallet.id);

    return { balance: parseFloat(updated.rows[0].balance), transactionId };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { getWalletByUserId, getBalance, deposit, withdraw };
