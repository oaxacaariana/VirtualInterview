/**
 * Profile route module.
 * Inputs: Express router plus profile controller handlers.
 * Outputs: Mounted routes for viewing and updating the authenticated user's profile.
 */
const express = require('express');
const router = express.Router();
const { showProfile, updateProfile } = require('../auth/profileController');

router.get('/', showProfile);
router.post('/', updateProfile);

module.exports = router;
