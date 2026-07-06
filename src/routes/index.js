const express = require('express');
const router = express.Router();

const authRoutes = require('./auth.routes');
const walletRoutes = require('./wallet.routes');
const transactionRoutes = require('./transaction.routes');
const adminRoutes = require('./admin.routes');

router.use('/auth', authRoutes);
router.use('/wallet', walletRoutes);
router.use('/transactions', transactionRoutes);
router.use('/admin', adminRoutes);

module.exports = router;
