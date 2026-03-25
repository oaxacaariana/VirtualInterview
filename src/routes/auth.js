const express = require('express');
const router = express.Router();
const { showLogin, showSignup, signup, login, logout } = require('../controllers/authController');

router.get('/login', showLogin);
router.post('/login', login);
router.get('/signup', showSignup);
router.post('/signup', signup);
router.post('/logout', logout);

module.exports = router;
