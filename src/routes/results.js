const express = require('express');
const router = express.Router();
const { showResultsPage } = require('../controllers/resultsController');

router.get('/', showResultsPage);

module.exports = router;