const express = require('express');
const router = express.Router();
const { showCalibrationPage } = require('../controllers/calibrationController');

router.get('/', showCalibrationPage);

module.exports = router;
