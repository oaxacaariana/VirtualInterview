/**
 * Interview API/page controller.
 * Inputs: Express req/res objects, interview request payloads, session state, and app-local collections.
 * Outputs: Renders the interview page and returns JSON responses for interview actions.
 */
const {
  getOpenAIClient,
  toFile,
  interviewModel,
  ttsModel,
  ttsVoice,
  ttsFormat,
  ttsInstructions,
  transcribeModel,
  transcribeLanguage,
  transcribePrompt,
} = require('../shared/openaiClient');
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
const { getInterviewClientConfig } = require('./interviewConfig');

const showOpenAIPage = async (req, res) => {
  try {
    const resumes = await mapResumesForView({
      collections: req.app.locals.collections,
      sessionUser: req.session?.user,
    });
    return res.render('openai', {
      model: interviewModel,
      resumes,
      interviewConfig: getInterviewClientConfig(),
    });
  } catch (error) {
    console.warn('Failed to load resumes for openai page:', error.message);
    return res.render('openai', {
      model: interviewModel,
      resumes: [],
      interviewConfig: getInterviewClientConfig(),
    });
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

const transcribeSpeech = async (req, res) => {
  try {
    const openaiClient = getOpenAIClient();
    requireConfiguredClient(openaiClient);

    if (!req.file?.buffer?.length) {
      return res.status(400).json({ error: 'audio file required' });
    }

    const audioFile = await toFile(
      req.file.buffer,
      req.file.originalname || 'recording.webm',
      { type: req.file.mimetype || 'audio/webm' }
    );

    const prompt = typeof req.body?.prompt === 'string' ? req.body.prompt.trim() : '';
    const language = typeof req.body?.language === 'string' ? req.body.language.trim() : '';

    const transcription = await openaiClient.audio.transcriptions.create({
      file: audioFile,
      model: transcribeModel,
      language: language || transcribeLanguage,
      prompt: prompt || transcribePrompt,
      response_format: 'json',
    });

    return res.json({
      text: transcription.text || '',
      model: transcribeModel,
    });
  } catch (error) {
    console.error('transcribeSpeech failed:', error);
    return res
      .status(error.status || 500)
      .json({ error: error.message || 'Speech transcription failed.' });
  }
};

const textToSpeech = async (req, res) => {
  try {
    const openaiClient = getOpenAIClient();
    requireConfiguredClient(openaiClient);

    const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
    if (!text) {
      return res.status(400).json({ error: 'text required' });
    }

    const requestedVoice = typeof req.body?.voice === 'string' ? req.body.voice.trim() : '';
    const requestedInstructions =
      typeof req.body?.instructions === 'string' ? req.body.instructions.trim() : '';

    const speechRequest = {
      model: ttsModel,
      voice: requestedVoice || ttsVoice,
      input: text.slice(0, 4096),
      response_format: ttsFormat,
    };

    if (ttsModel === 'gpt-4o-mini-tts' || ttsModel === 'gpt-4o-realtime-preview') {
      speechRequest.instructions = requestedInstructions || ttsInstructions;
    }

    const response = await openaiClient.audio.speech.create(speechRequest);

    const buffer = Buffer.from(await response.arrayBuffer());
    const contentType =
      ttsFormat === 'wav'
        ? 'audio/wav'
        : ttsFormat === 'mp3'
          ? 'audio/mpeg'
          : 'application/octet-stream';

    res.set('Content-Type', contentType);
    res.set('Content-Length', buffer.length);
    res.set('Cache-Control', 'no-store');
    res.set('X-TTS-Model', ttsModel);
    res.set('X-TTS-Voice', requestedVoice || ttsVoice);
    return res.send(buffer);
  } catch (error) {
    console.error('textToSpeech failed:', error);
    return res.status(error.status || 500).json({ error: error.message || 'TTS failed' });
  }
};

module.exports = {
  showOpenAIPage,
  askOpenAI,
  startInterview,
  closeChat,
  getReview,
  transcribeSpeech,
  textToSpeech,
};
