/**
 * Interview route module.
 * Inputs: Express router plus interview and transcript controller handlers.
 * Outputs: Mounted page, API, transcript, and review routes for the interview feature.
 */
const express = require('express');
const multer = require('multer');
const router = express.Router();
const {
  showOpenAIPage,
  askOpenAI,
  startInterview,
  closeChat,
  getReview,
  transcribeSpeech,
  textToSpeech,
} = require('../interviews/interviewController');
const {
  showChatLogsPage,
  showChatLogDetail,
  listTranscripts,
} = require('../interviews/transcriptController');

const audioUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 12 * 1024 * 1024,
  },
});

router.get('/', showOpenAIPage);
router.get('/logs', showChatLogsPage);
router.get('/logs.json', listTranscripts);
router.get('/logs/:chatId', showChatLogDetail);
router.get('/review', getReview);
router.post('/ask', askOpenAI);
router.post('/start', startInterview);
router.post('/close', closeChat);
router.post('/transcribe', audioUpload.single('audio'), transcribeSpeech);
router.post('/tts', textToSpeech);

module.exports = router;
