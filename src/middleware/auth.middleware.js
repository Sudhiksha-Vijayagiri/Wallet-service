const { verifyAccessToken } = require('../utils/jwt');
const ApiError = require('../utils/ApiError');

// checks Authorization: Bearer <token> header, verifies it and
// attaches the decoded user info to req.user for later use
function authenticate(req, res, next) {
  const authHeader = req.headers['authorization'];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new ApiError(401, 'no token provided'));
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = verifyAccessToken(token);
    req.user = decoded; // { id, email, role }
    next();
  } catch (err) {
    return next(new ApiError(401, 'invalid or expired token'));
  }
}

// only allow admins past this point, use after authenticate
function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return next(new ApiError(403, 'admins only'));
  }
  next();
}

module.exports = { authenticate, requireAdmin };
