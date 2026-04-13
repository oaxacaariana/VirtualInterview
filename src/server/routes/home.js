/**
 * Home route module.
 * Inputs: Express router plus the home controller.
 * Outputs: Mounted route for the public landing page.
 */
const express = require('express');
const router = express.Router();
const { showHomePage } = require('../home/homeController');

router.get('/', showHomePage);

module.exports = router;
