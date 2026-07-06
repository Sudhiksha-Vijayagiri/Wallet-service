const pool = require('../config/db');
const ApiError = require('../utils/ApiError');
const redisService = require('./redis.service');
const { getProducer } = require('../config/kafka');
require('dotenv').config();

// transfers money from one user's wallet to another user's wallet.
// this is the most important function in the whole project so
// a few things need to happen carefully here:
//
// 1. everything happens inside one db transaction (all or nothing)
// 2. we lock both wallet rows with SELECT ... FOR UPDATE so two
//    transfers touching the same wallet can't race each other
// 3. we always lock in the same order (lower wallet id first) so two
//    transfers going in opposite directions between the same two wallets
//    don't deadlock each other
// 4. idempotency_key stops the same transfer request from being applied
//    twice if the client retries (e.g. request timed out but actually succeeded)

async function transferMoney({ senderUserId, receiverEmail, amount, idempotencyKey }) {
  if (amount <= 0) {
    throw new ApiError(400, 'transfer amount must be greater than 0');
  }

  // if this idempotency key was already used, just return the old transaction
  // instead of doing the transfer again
  if (idempotencyKey) {
    const existing = await pool.query(
      'SELECT * FROM transactions WHERE idempotency_key = $1',
      [idempotencyKey]
    );
    if (existing.rows.length > 0) {
      return { transaction: existing.rows[0], duplicate: true };
    }
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const senderWalletRes = await client.query(
      `SELECT w.* FROM wallets w
       JOIN users u ON u.id = w.user_id
       WHERE w.user_id = $1`,
      [senderUserId]
    );
    const senderWallet = senderWalletRes.rows[0];
    if (!senderWallet) {
      throw new ApiError(404, 'sender wallet not found');
    }

    const receiverWalletRes = await client.query(
      `SELECT w.* FROM wallets w
       JOIN users u ON u.id = w.user_id
       WHERE u.email = $1`,
      [receiverEmail]
    );
    const receiverWallet = receiverWalletRes.rows[0];
    if (!receiverWallet) {
      throw new ApiError(404, 'receiver not found');
    }

    if (senderWallet.id === receiverWallet.id) {
      throw new ApiError(400, "can't transfer to your own wallet");
    }

    // lock in a consistent order (by wallet id) to avoid deadlocks when
    // two transfers happen between the same pair of wallets at the same time
    const walletIdsInOrder = [senderWallet.id, receiverWallet.id].sort();

    for (const id of walletIdsInOrder) {
      await client.query('SELECT * FROM wallets WHERE id = $1 FOR UPDATE', [id]);
    }

    // re-check balance after acquiring the lock, since it might have changed
    const freshSenderRes = await client.query('SELECT * FROM wallets WHERE id = $1', [senderWallet.id]);
    const freshSender = freshSenderRes.rows[0];

    if (parseFloat(freshSender.balance) < amount) {
      throw new ApiError(400, 'insufficient balance');
    }

    const txnResult = await client.query(
      `INSERT INTO transactions (sender_wallet_id, receiver_wallet_id, amount, status, idempotency_key)
       VALUES ($1, $2, $3, 'completed', $4)
       RETURNING *`,
      [senderWallet.id, receiverWallet.id, amount, idempotencyKey || null]
    );
    const transaction = txnResult.rows[0];

    // ledger entries - one debit, one credit, this is what makes the
    // accounting auditable instead of just trusting the balance column
    await client.query(
      `INSERT INTO ledger_entries (transaction_id, wallet_id, entry_type, amount)
       VALUES ($1, $2, 'DEBIT', $3)`,
      [transaction.id, senderWallet.id, amount]
    );
    await client.query(
      `INSERT INTO ledger_entries (transaction_id, wallet_id, entry_type, amount)
       VALUES ($1, $2, 'CREDIT', $3)`,
      [transaction.id, receiverWallet.id, amount]
    );

    await client.query(
      'UPDATE wallets SET balance = balance - $1 WHERE id = $2',
      [amount, senderWallet.id]
    );
    await client.query(
      'UPDATE wallets SET balance = balance + $1 WHERE id = $2',
      [amount, receiverWallet.id]
    );

    await client.query('COMMIT');

    // invalidate cached balances for both wallets since they just changed
    await redisService.invalidateBalance(senderWallet.id);
    await redisService.invalidateBalance(receiverWallet.id);

    // publish event AFTER commit - if this fails, the transfer itself is
    // already safely done, we just lose the notification which is fine
    try {
      const producer = await getProducer();
      await producer.send({
        topic: process.env.KAFKA_TRANSACTION_TOPIC || 'transaction-completed',
        messages: [
          {
            value: JSON.stringify({
              transactionId: transaction.id,
              senderWalletId: senderWallet.id,
              receiverWalletId: receiverWallet.id,
              amount
            })
          }
        ]
      });
    } catch (kafkaErr) {
      // don't fail the whole request just because kafka is down
      console.error('failed to publish transaction event:', kafkaErr.message);
    }

    return { transaction, duplicate: false };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function getTransactionHistory(userId) {
  const walletRes = await pool.query('SELECT id FROM wallets WHERE user_id = $1', [userId]);
  const wallet = walletRes.rows[0];
  if (!wallet) {
    throw new ApiError(404, 'wallet not found');
  }

  const result = await pool.query(
    `SELECT * FROM transactions
     WHERE sender_wallet_id = $1 OR receiver_wallet_id = $1
     ORDER BY created_at DESC
     LIMIT 50`,
    [wallet.id]
  );

  return result.rows;
}

// sanity check function - sums up ledger entries for a wallet and compares
// it to the actual balance column. if these ever don't match, something is
// wrong with the transfer logic. good to run this in tests / as a cron later
async function reconcileWallet(walletId) {
  const walletRes = await pool.query('SELECT balance FROM wallets WHERE id = $1', [walletId]);
  if (walletRes.rows.length === 0) {
    throw new ApiError(404, 'wallet not found');
  }

  const ledgerRes = await pool.query(
    `SELECT
       COALESCE(SUM(CASE WHEN entry_type = 'CREDIT' THEN amount ELSE 0 END), 0) -
       COALESCE(SUM(CASE WHEN entry_type = 'DEBIT' THEN amount ELSE 0 END), 0) AS computed_balance
     FROM ledger_entries
     WHERE wallet_id = $1`,
    [walletId]
  );

  const actualBalance = parseFloat(walletRes.rows[0].balance);
  const computedBalance = parseFloat(ledgerRes.rows[0].computed_balance);

  return {
    walletId,
    actualBalance,
    computedBalance,
    matches: actualBalance === computedBalance
  };
}

module.exports = { transferMoney, getTransactionHistory, reconcileWallet };
