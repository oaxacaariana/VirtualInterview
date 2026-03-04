const express = require('express');
const router = express.Router();
const { showOpenAIPage, askOpenAI } = require('../controllers/openaiController');

router.get('/', showOpenAIPage);
router.post('/ask', askOpenAI);

module.exports = router;
