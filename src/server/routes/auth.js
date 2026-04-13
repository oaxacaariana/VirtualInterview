/**
 * Authentication route module.
 * Inputs: Express router plus auth controller handlers.
 * Outputs: Mounted login, signup, and logout routes.
 */
const express = require('express');
const router = express.Router();
const {
  showLogin,
  showForgotPassword,
  showSignup,
  signup,
  login,
  forgotPassword,
  logout,
} = require('../auth/authController');

router.get('/login', showLogin);
router.post('/login', login);
router.get('/forgot-password', showForgotPassword);
router.post('/forgot-password', forgotPassword);
router.get('/signup', showSignup);
router.post('/signup', signup);
router.post('/logout', logout);

module.exports = router;
