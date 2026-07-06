// redis client, used for two things in this project:
// 1. caching wallet balances so we don't hit postgres on every read
// 2. rate limiting login/transfer endpoints

const Redis = require("ioredis");

const redisClient = new Redis(process.env.REDIS_URL);
require('dotenv').config();

// const redisClient = new Redis({
//   host: process.env.REDIS_HOST || 'localhost',
//   port: process.env.REDIS_PORT || 6379,
//   // don't let a bad/missing redis config crash the whole app - retry with
//   // backoff in the background instead of throwing after a few attempts
//   maxRetriesPerRequest: 1,
//   retryStrategy(times) {
//     // cap the delay so it doesn't wait forever between retries, but keeps trying
//     return Math.min(times * 500, 5000);
//   },
//   // queue commands while disconnected instead of throwing immediately -
//   // they'll just fail individually (caught below) rather than crashing node
//   enableOfflineQueue: true
// });

redisClient.on('connect', () => {
  console.log('connected to redis');
});

redisClient.on('error', (err) => {
  // log it, but do NOT let this crash the process - the app should keep
  // serving requests even if caching/rate-limiting is temporarily unavailable
  console.error('redis connection error:', err.message);
});

module.exports = redisClient;