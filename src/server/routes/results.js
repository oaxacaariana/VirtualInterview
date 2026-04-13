/**
 * Results route module.
 * Inputs: Express router plus the resume results controller handler.
 * Outputs: Mounted route for rendering resume scoring results.
 */
const express = require('express');
const router = express.Router();
const { showResultsPage } = require('../resumes/resumeController');

router.get('/', showResultsPage);

module.exports = router;
