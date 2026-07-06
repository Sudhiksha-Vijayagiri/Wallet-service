const asyncHandler = require('../utils/asyncHandler');
const { successResponse } = require('../utils/response');
const walletService = require('../services/wallet.service');
const ApiError = require('../utils/ApiError');

const getBalance = asyncHandler(async (req, res) => {
  const result = await walletService.getBalance(req.user.id);
  return successResponse(res, 200, 'balance fetched', result);
});

const deposit = asyncHandler(async (req, res) => {
  const { amount } = req.body;
  if (amount === undefined) {
    throw new ApiError(400, 'amount is required');
  }
  const result = await walletService.deposit(req.user.id, parseFloat(amount));
  return successResponse(res, 200, 'deposit successful', result);
});

const withdraw = asyncHandler(async (req, res) => {
  const { amount } = req.body;
  if (amount === undefined) {
    throw new ApiError(400, 'amount is required');
  }
  const result = await walletService.withdraw(req.user.id, parseFloat(amount));
  return successResponse(res, 200, 'withdraw successful', result);
});

module.exports = { getBalance, deposit, withdraw };
