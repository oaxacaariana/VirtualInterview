const express = require('express');
const router = express.Router();
const {
  showOpenAIPage,
  askOpenAI,
  startInterview,
  closeChat,
  listTranscripts,
} = require('../controllers/openaiController');

router.get('/', showOpenAIPage);
router.post('/ask', askOpenAI);
router.post('/start', startInterview);
router.post('/close', closeChat);
router.get('/logs', listTranscripts);

module.exports = router;
