const express = require('express');
const router = express.Router();
const { showHomePage } = require('../controllers/homeController');

router.get('/', showHomePage);

module.exports = router;