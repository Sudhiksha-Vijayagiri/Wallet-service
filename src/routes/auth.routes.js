const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { authLimiter } = require('../middleware/rateLimiter.middleware');

/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: register a new user (also creates a wallet for them)
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               fullName: { type: string }
 *               email: { type: string }
 *               password: { type: string }
 *     responses:
 *       201: { description: user created }
 */
router.post('/register', authLimiter, authController.register);

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: login with email and password
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email: { type: string }
 *               password: { type: string }
 *     responses:
 *       200: { description: returns access + refresh token }
 */
router.post('/login', authLimiter, authController.login);

/**
 * @swagger
 * /auth/refresh:
 *   post:
 *     summary: get a new access token using a refresh token
 *     tags: [Auth]
 *     responses:
 *       200: { description: new access token }
 */
router.post('/refresh', authController.refresh);

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     summary: logout (client just discards the tokens, stateless)
 *     tags: [Auth]
 *     responses:
 *       200: { description: logged out }
 */
router.post('/logout', authController.logout);

module.exports = router;
