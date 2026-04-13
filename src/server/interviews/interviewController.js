/**
 * Interview API/page controller.
 * Inputs: Express req/res objects, interview request payloads, session state, and app-local collections.
 * Outputs: Renders the interview page and returns JSON responses for interview actions.
 */
const { getOpenAIClient, interviewModel } = require('../shared/openaiClient');
const {
  requireConfiguredClient,
  validateStartInterviewInput,
  validateAskInterviewInput,
} = require('./interviewValidators');
const {
  mapResumesForView,
  startInterviewSession,
  continueInterview,
  getTurnAnalysis,
  finalizeInterview,
  ensureChatId,
} = require('./interviewService');

const showOpenAIPage = async (req, res) => {
  try {
    const resumes = await mapResumesForView({
      collections: req.app.locals.collections,
      sessionUser: req.session?.user,
    });
    return res.render('openai', { model: interviewModel, resumes });
  } catch (error) {
    console.warn('Failed to load resumes for openai page:', error.message);
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
  } catch (error) {
    console.error('closeChat failed:', error);
    return res.status(error.status || 500).json({ error: error.message || 'Failed to close chat.' });
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

module.exports = {
  showOpenAIPage,
  askOpenAI,
  startInterview,
  closeChat,
  getReview,
};
