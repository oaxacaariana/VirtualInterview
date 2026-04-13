const express = require('express');
const router = express.Router();
const {
  showOpenAIPage,
  askOpenAI,
  startInterview,
  closeChat,
  getReview,
  showChatLogsPage,
  showChatLogDetail,
  listTranscripts,
  textToSpeech,
} = require('../controllers/openaiController');

router.get('/', showOpenAIPage);
router.get('/logs', showChatLogsPage);
router.get('/logs.json', listTranscripts);
router.get('/logs/:chatId', showChatLogDetail);
router.get('/review', getReview);
router.post('/ask', askOpenAI);
router.post('/start', startInterview);
router.post('/close', closeChat);
router.post('/tts', textToSpeech);

module.exports = router;
