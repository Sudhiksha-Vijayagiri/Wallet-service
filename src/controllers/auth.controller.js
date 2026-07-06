const asyncHandler = require('../utils/asyncHandler');
const { successResponse } = require('../utils/response');
const authService = require('../services/auth.service');
const ApiError = require('../utils/ApiError');

const register = asyncHandler(async (req, res) => {
  const { fullName, email, password } = req.body;

  if (!fullName || !email || !password) {
    throw new ApiError(400, 'fullName, email and password are required');
  }

  const user = await authService.registerUser({ fullName, email, password });
  return successResponse(res, 201, 'user registered successfully', user);
});

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    throw new ApiError(400, 'email and password are required');
  }

  const result = await authService.loginUser({ email, password });
  return successResponse(res, 200, 'login successful', result);
});

const refresh = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  const result = await authService.refreshAccessToken(refreshToken);
  return successResponse(res, 200, 'token refreshed', result);
});

// logout is stateless here since we're not maintaining a session/token
// blacklist table for this project - client just deletes the token
const logout = asyncHandler(async (req, res) => {
  return successResponse(res, 200, 'logged out, please discard your tokens on client side');
});

module.exports = { register, login, refresh, logout };
