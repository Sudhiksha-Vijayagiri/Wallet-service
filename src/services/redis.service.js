// small helper functions around the redis client
// used mainly for caching wallet balances (cache-aside pattern)

const redisClient = require('../config/redis');

const BALANCE_CACHE_TTL = 60; // seconds, short ttl so stale cache isn't a big issue

function balanceKey(walletId) {
  return `wallet:balance:${walletId}`;
}

async function getCachedBalance(walletId) {
  const cached = await redisClient.get(balanceKey(walletId));
  return cached !== null ? parseFloat(cached) : null;
}

async function setCachedBalance(walletId, balance) {
  await redisClient.set(balanceKey(walletId), balance, 'EX', BALANCE_CACHE_TTL);
}

async function invalidateBalance(walletId) {
  await redisClient.del(balanceKey(walletId));
}

module.exports = {
  getCachedBalance,
  setCachedBalance,
  invalidateBalance
};
