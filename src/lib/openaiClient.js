const OpenAI = require('openai');

const interviewModel = process.env.MODEL || 'gpt-4.1-mini';
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
};
