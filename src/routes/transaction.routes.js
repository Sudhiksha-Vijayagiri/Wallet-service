const express = require('express');
const router = express.Router();
const transactionController = require('../controllers/transaction.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { transferLimiter } = require('../middleware/rateLimiter.middleware');

/**
 * @swagger
 * /transactions/transfer:
 *   post:
 *     summary: transfer money to another user by email
 *     tags: [Transactions]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: header
 *         name: Idempotency-Key
 *         schema: { type: string }
 *         required: false
 *         description: optional key to make retried requests safe
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               receiverEmail: { type: string }
 *               amount: { type: number }
 *     responses:
 *       200: { description: transfer successful }
 */
router.post('/transfer', authenticate, transferLimiter, transactionController.transfer);

/**
 * @swagger
 * /transactions/history:
 *   get:
 *     summary: get last 50 transactions for the current user's wallet
 *     tags: [Transactions]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: transaction history }
 */
router.get('/history', authenticate, transactionController.history);

module.exports = router;
