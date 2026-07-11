const asyncHandler = require('../utils/asyncHandler');
const { successResponse } = require('../utils/response');
const pool = require('../config/db');
const transactionService = require('../services/transaction.service');

const getAllUsers = asyncHandler(async (req, res) => {
  // joined with wallets so the wallet id is visible right here - saves
  // having to go dig through the database directly just to find a wallet id
  const result = await pool.query(
    `SELECT u.id, u.full_name, u.email, u.role, u.created_at,
            w.id AS wallet_id, w.balance AS wallet_balance
     FROM users u
     LEFT JOIN wallets w ON w.user_id = u.id
     ORDER BY u.created_at DESC`
  );
  return successResponse(res, 200, 'users fetched', result.rows);
});

const getAllTransactions = asyncHandler(async (req, res) => {
  const result = await pool.query(
    'SELECT * FROM transactions ORDER BY created_at DESC LIMIT 100'
  );
  return successResponse(res, 200, 'transactions fetched', result.rows);
});

// endpoint to manually trigger the reconciliation check for a wallet
// mainly useful for demoing / testing that the ledger math is correct
const reconcile = asyncHandler(async (req, res) => {
  const { walletId } = req.params;
  const result = await transactionService.reconcileWallet(walletId);
  return successResponse(res, 200, 'reconciliation check complete', result);
});

module.exports = { getAllUsers, getAllTransactions, reconcile };