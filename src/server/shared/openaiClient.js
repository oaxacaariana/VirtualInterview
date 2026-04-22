/**
 * Shared OpenAI client module.
 * Inputs: Environment variables for API key and model selection.
 * Outputs: A cached OpenAI client instance plus model names used across the app.
 */
const OpenAI = require('openai');
const { toFile } = require('openai');

const interviewModel = process.env.MODEL || 'gpt-4.1-mini';
const reviewModel = process.env.REVIEW_MODEL || interviewModel;
const ttsModel = process.env.TTS_MODEL || 'gpt-4o-mini-tts';
const ttsVoice = process.env.TTS_VOICE || 'shimmer';
const ttsFormat = process.env.TTS_FORMAT || 'mp3';
const ttsInstructions =
  process.env.TTS_INSTRUCTIONS ||
  'Speak like a calm, professional mock interviewer. Sound clear, confident, and encouraging.';
const transcribeModel = process.env.TRANSCRIBE_MODEL || 'gpt-4o-mini-transcribe';
const transcribeLanguage = process.env.TRANSCRIBE_LANGUAGE || 'en';
const transcribePrompt =
  process.env.TRANSCRIBE_PROMPT ||
  'Transcribe spoken interview answers clearly, preserving punctuation and common technical terms.';
let client;

const getOpenAIClient = () => {
  if (!process.env.OPENAI_API_KEY) {
    return null;
  }

  if (!client) {
    client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  return client;
};

module.exports = {
  getOpenAIClient,
  toFile,
  interviewModel,
  reviewModel,
  ttsModel,
  ttsVoice,
  ttsFormat,
  ttsInstructions,
  transcribeModel,
  transcribeLanguage,
  transcribePrompt,
};
