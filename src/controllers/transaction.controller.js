const asyncHandler = require('../utils/asyncHandler');
const { successResponse } = require('../utils/response');
const transactionService = require('../services/transaction.service');
const ApiError = require('../utils/ApiError');

const transfer = asyncHandler(async (req, res) => {
  const { receiverEmail, amount } = req.body;
  // client can send this header to make the request retry-safe
  // if they don't send one, the transfer still works, just without
  // the duplicate-protection benefit
  const idempotencyKey = req.headers['idempotency-key'];

  if (!receiverEmail || amount === undefined) {
    throw new ApiError(400, 'receiverEmail and amount are required');
  }

  const result = await transactionService.transferMoney({
    senderUserId: req.user.id,
    receiverEmail,
    amount: parseFloat(amount),
    idempotencyKey
  });

  const message = result.duplicate
    ? 'this transfer was already processed (duplicate request)'
    : 'transfer successful';

  return successResponse(res, 200, message, result.transaction);
});

const history = asyncHandler(async (req, res) => {
  const transactions = await transactionService.getTransactionHistory(req.user.id);
  return successResponse(res, 200, 'transaction history fetched', transactions);
});

module.exports = { transfer, history };
