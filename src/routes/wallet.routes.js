const express = require('express');
const router = express.Router();
const walletController = require('../controllers/wallet.controller');
const { authenticate } = require('../middleware/auth.middleware');

/**
 * @swagger
 * /wallet/balance:
 *   get:
 *     summary: get current user's wallet balance (cached in redis)
 *     tags: [Wallet]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: balance returned }
 */
router.get('/balance', authenticate, walletController.getBalance);

/**
 * @swagger
 * /wallet/deposit:
 *   post:
 *     summary: deposit money into own wallet
 *     tags: [Wallet]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               amount: { type: number }
 *     responses:
 *       200: { description: deposit successful }
 */
router.post('/deposit', authenticate, walletController.deposit);

/**
 * @swagger
 * /wallet/withdraw:
 *   post:
 *     summary: withdraw money from own wallet
 *     tags: [Wallet]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               amount: { type: number }
 *     responses:
 *       200: { description: withdraw successful }
 */
router.post('/withdraw', authenticate, walletController.withdraw);

module.exports = router;
