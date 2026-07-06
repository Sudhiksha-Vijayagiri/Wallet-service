// rate limiting using redis as the store, so it works correctly even if
// we run multiple instances of the app (in-memory limiter wouldn't share state)
const rateLimit = require('express-rate-limit');
const { RedisStore } = require('rate-limit-redis');
const redisClient = require('../config/redis');
// stricter limiter for auth routes (login/register) - prevent brute forcing
const authLimiter = rateLimit({
  store: new RedisStore({
    sendCommand: (...args) => redisClient.call(...args),
    prefix: 'rl:auth:'
  }),
  windowMs: 15 * 60 * 1000, // 15 min
  max: 10, // 10 requests per window per ip
  message: {
    success: false,
    message: 'too many auth attempts, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// slightly looser limiter for transfer endpoint
const transferLimiter = rateLimit({
  store: new RedisStore({
    sendCommand: (...args) => redisClient.call(...args),
    prefix: 'rl:transfer:'
  }),
  windowMs: 60 * 1000, // 1 min
  max: 20,
  message: {
    success: false,
    message: 'too many transfer requests, slow down'
  },
  standardHeaders: true,
  legacyHeaders: false
});

module.exports = { authLimiter, transferLimiter };
