const express = require('express');
const router = express.Router();
const { showProfile, updateProfile } = require('../controllers/profileController');

router.get('/', showProfile);
router.post('/', updateProfile);

module.exports = router;
