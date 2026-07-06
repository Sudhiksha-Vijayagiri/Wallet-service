const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin.controller');
const { authenticate, requireAdmin } = require('../middleware/auth.middleware');

/**
 * @swagger
 * /admin/users:
 *   get:
 *     summary: get all registered users (admin only)
 *     tags: [Admin]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: list of users }
 */
router.get('/users', authenticate, requireAdmin, adminController.getAllUsers);

/**
 * @swagger
 * /admin/transactions:
 *   get:
 *     summary: get all transactions across the system (admin only)
 *     tags: [Admin]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: list of transactions }
 */
router.get('/transactions', authenticate, requireAdmin, adminController.getAllTransactions);

/**
 * @swagger
 * /admin/reconcile/{walletId}:
 *   get:
 *     summary: check that a wallet's balance matches the sum of its ledger entries
 *     tags: [Admin]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: walletId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: reconciliation result }
 */
router.get('/reconcile/:walletId', authenticate, requireAdmin, adminController.reconcile);

module.exports = router;
