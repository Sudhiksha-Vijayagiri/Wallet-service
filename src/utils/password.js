// bcrypt is intentionally slow so brute forcing hashes is expensive
// 10 salt rounds is the usual recommended default, good enough for this project

const bcrypt = require('bcrypt');

const SALT_ROUNDS = 10;

async function hashPassword(plainPassword) {
  return bcrypt.hash(plainPassword, SALT_ROUNDS);
}

async function comparePassword(plainPassword, hash) {
  return bcrypt.compare(plainPassword, hash);
}

module.exports = { hashPassword, comparePassword };
