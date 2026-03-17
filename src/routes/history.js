const express = require('express');
const multer = require('multer');
const router = express.Router();
const { showHistoryPage } = require('../controllers/historyController');

router.get('/', showHistoryPage);

module.exports = router;