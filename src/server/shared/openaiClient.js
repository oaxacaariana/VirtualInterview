/**
 * Shared OpenAI client module.
 * Inputs: Environment variables for API key and model selection.
 * Outputs: A cached OpenAI client instance plus model names used across the app.
 */
const OpenAI = require('openai');

const interviewModel = process.env.MODEL || 'gpt-4.1-mini';
const reviewModel = process.env.REVIEW_MODEL || interviewModel;
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
  interviewModel,
  reviewModel,
};
