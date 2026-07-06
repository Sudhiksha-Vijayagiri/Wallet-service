// small helper functions around the redis client
// used mainly for caching wallet balances (cache-aside pattern)
//
// these all fail "open" - if redis is down or misconfigured, we just skip
// the cache instead of blowing up the request. caching is a nice-to-have,
// it should never be the reason a balance check or transfer fails

const redisClient = require('../config/redis');

const BALANCE_CACHE_TTL = 60; // seconds, short ttl so stale cache isn't a big issue

function balanceKey(walletId) {
  return `wallet:balance:${walletId}`;
}

async function getCachedBalance(walletId) {
  try {
    const cached = await redisClient.get(balanceKey(walletId));
    return cached !== null ? parseFloat(cached) : null;
  } catch (err) {
    console.error('redis get failed, skipping cache:', err.message);
    return null;
  }
}

async function setCachedBalance(walletId, balance) {
  try {
    await redisClient.set(balanceKey(walletId), balance, 'EX', BALANCE_CACHE_TTL);
  } catch (err) {
    console.error('redis set failed, skipping cache:', err.message);
  }
}

async function invalidateBalance(walletId) {
  try {
    await redisClient.del(balanceKey(walletId));
  } catch (err) {
    console.error('redis del failed, skipping cache invalidation:', err.message);
  }
}

module.exports = {
  getCachedBalance,
  setCachedBalance,
  invalidateBalance
};