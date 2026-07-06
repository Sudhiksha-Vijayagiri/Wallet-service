// redis client, used for two things in this project:
// 1. caching wallet balances so we don't hit postgres on every read
// 2. rate limiting login/transfer endpoints

const Redis = require('ioredis');
require('dotenv').config();

const redisClient = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  maxRetriesPerRequest: 3
});

redisClient.on('connect', () => {
  console.log('connected to redis');
});

redisClient.on('error', (err) => {
  console.error('redis connection error:', err.message);
});

module.exports = redisClient;
