const { ObjectId } = require('mongodb');
const { getOpenAIClient, interviewModel } = require('../lib/openaiClient');
const { toObjectId } = require('../repositories/resumeRepository');
const { markChatClosed, listRecentChatsForUser } = require('../repositories/chatRepository');
const {
  requireConfiguredClient,
  validateStartInterviewInput,
  validateAskInterviewInput,
} = require('../services/interview/interviewValidators');
const {
  mapResumesForView,
  startInterviewSession,
  continueInterview,
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
    const userId = (req.session?.user?.id && new ObjectId(req.session.user.id)) || null;
    const chatId = ensureChatId(req.body?.chatId);
    const result = await markChatClosed({
      collections: req.app.locals.collections,
      chatId,
      userId,
    });

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'Chat not found.' });
    }

    return res.json({ ok: true });
  } catch (err) {
    console.error('closeChat failed:', err);
    return res.status(500).json({ error: 'Failed to close chat.' });
  }
};

module.exports = { showOpenAIPage, askOpenAI, startInterview, closeChat };

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
