const { getOpenAIClient, interviewModel } = require('../lib/openaiClient');
const { toObjectId } = require('../repositories/resumeRepository');
const { findInterviewScoreByChatId } = require('../repositories/interviewScoreRepository');
const {
  listRecentChatsForUser,
  findChatLogByChatId,
  listChatTurnsForChat,
} = require('../repositories/chatRepository');
const {
  requireConfiguredClient,
  validateStartInterviewInput,
  validateAskInterviewInput,
} = require('../services/interview/interviewValidators');
const {
  mapResumesForView,
  startInterviewSession,
  continueInterview,
  getTurnAnalysis,
  finalizeInterview,
  ensureChatId,
} = require('../services/interview/interviewService');

const showOpenAIPage = async (req, res) => {
  try {
    const resumes = await mapResumesForView({
      collections: req.app.locals.collections,
      sessionUser: req.session?.user,
    });
    return res.render('openai', { model: interviewModel, resumes });
  } catch (err) {
    console.warn('Failed to load resumes for openai page:', err.message);
    return res.render('openai', { model: interviewModel, resumes: [] });
  }
};

const askOpenAI = async (req, res) => {
  try {
    const openaiClient = getOpenAIClient();
    requireConfiguredClient(openaiClient);

    const input = validateAskInterviewInput(req.body);
    const result = await continueInterview({
      collections: req.app.locals.collections,
      sessionUser: req.session?.user,
      sessionId: req.sessionID,
      openaiClient,
      input: {
        ...input,
        chatId: ensureChatId(input.chatId),
      },
    });

    return res.json(result);
  } catch (error) {
    console.error('OpenAI request failed:', error);
    return res.status(error.status || 500).json({
      error: error.status ? error.message : 'OpenAI request failed. Check your API key or try again shortly.',
      detail: error?.response?.data || error.message,
    });
  }
};

const startInterview = async (req, res) => {
  try {
    const openaiClient = getOpenAIClient();
    requireConfiguredClient(openaiClient);

    const input = validateStartInterviewInput(req.body);
    const result = await startInterviewSession({
      collections: req.app.locals.collections,
      sessionUser: req.session?.user,
      openaiClient,
      input: {
        ...input,
        chatId: ensureChatId(input.chatId),
      },
    });

    return res.json(result);
  } catch (error) {
    console.error('startInterview failed:', error);
    return res.status(error.status || 500).json({ error: error.message || 'Failed to generate opener.' });
  }
};

const closeChat = async (req, res) => {
  try {
    const openaiClient = getOpenAIClient();
    requireConfiguredClient(openaiClient);
    const chatId = ensureChatId(req.body?.chatId);
    const result = await finalizeInterview({
      collections: req.app.locals.collections,
      chatId,
      sessionUser: req.session?.user,
      sessionId: req.sessionID,
      openaiClient,
    });

    return res.json(result);
  } catch (err) {
    console.error('closeChat failed:', err);
    return res.status(err.status || 500).json({ error: err.message || 'Failed to close chat.' });
  }
};

const getReview = async (req, res) => {
  try {
    const result = await getTurnAnalysis({
      collections: req.app.locals.collections,
      sessionUser: req.session?.user,
      chatId: req.query?.chatId,
      turn: req.query?.turn,
    });
    return res.json(result);
  } catch (error) {
    return res.status(error.status || 500).json({ error: error.message || 'Failed to load turn review.' });
  }
};

const showChatLogsPage = async (req, res) => {
  try {
    const userId = toObjectId(req.session?.user?.id);
    const docs = await listRecentChatsForUser({
      collections: req.app.locals.collections,
      userId,
    });

    const scoredChats = await Promise.all(
      docs.map(async (chat) => ({
        ...chat,
        finalScore: await findInterviewScoreByChatId({
          collections: req.app.locals.collections,
          userId,
          chatId: chat.chatId,
        }),
      }))
    );

    return res.render('chat-logs', { chats: scoredChats });
  } catch (error) {
    return res.status(500).render('chat-logs', { chats: [] });
  }
};

const showChatLogDetail = async (req, res) => {
  try {
    const userId = toObjectId(req.session?.user?.id);
    const chatId = ensureChatId(req.params.chatId);
    const chat = await findChatLogByChatId({
      collections: req.app.locals.collections,
      chatId,
      userId,
    });

    if (!chat) {
      return res.status(404).send('Chat log not found.');
    }

    const turns = await listChatTurnsForChat({
      collections: req.app.locals.collections,
      chatId,
      userId,
    });

    const finalScore = await findInterviewScoreByChatId({
      collections: req.app.locals.collections,
      userId,
      chatId,
    });

    return res.render('chat-log-detail', { chat, turns, finalScore });
  } catch (error) {
    return res.status(500).send(error.message || 'Failed to load chat log.');
  }
};

module.exports = {
  showOpenAIPage,
  askOpenAI,
  startInterview,
  closeChat,
  getReview,
  showChatLogsPage,
  showChatLogDetail,
};

module.exports.listTranscripts = async (req, res) => {
  try {
    const userId = toObjectId(req.session?.user?.id);
    const docs = await listRecentChatsForUser({
      collections: req.app.locals.collections,
      userId,
    });
    return res.json(docs);
  } catch (error) {
    return res.status(500).json({ error: error.message || 'chatLogs unavailable' });
  }
};

module.exports.textToSpeech = async (req, res) => {
  const openai = getOpenAIClient();
  if (!openai) return res.status(503).json({ error: 'OpenAI not configured' });

  const { text } = req.body;
  if (!text || typeof text !== 'string') return res.status(400).json({ error: 'text required' });

  // Truncate to 4096 chars — TTS model hard limit
  const input = text.slice(0, 4096);

  try {
    const response = await openai.audio.speech.create({
      model: 'tts-1',
      voice: 'shimmer',
      input,
      response_format: 'mp3',
    });

    const buffer = Buffer.from(await response.arrayBuffer());
    res.set('Content-Type', 'audio/mpeg');
    res.set('Content-Length', buffer.length);
    res.set('Cache-Control', 'no-store');
    return res.send(buffer);
  } catch (error) {
    return res.status(500).json({ error: error.message || 'TTS failed' });
  }
};
