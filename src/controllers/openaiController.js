const OpenAI = require('openai');

const model = process.env.MODEL || 'gpt-4.1-mini';
let client;

const getClient = () => {
  if (!process.env.OPENAI_API_KEY) {
    return null;
  }

  if (!client) {
    client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  return client;
};

const showOpenAIPage = (req, res) => {
  res.render('openai', { model });
};

const askOpenAI = async (req, res) => {
  const { prompt, transcript = [] } = req.body || {};

  const openaiClient = getClient();

  if (!openaiClient) {
    return res.status(500).json({
      error: 'Server is missing OPENAI_API_KEY. Add it to your .env file.',
    });
  }

  if (!prompt || !prompt.trim()) {
    return res.status(400).json({ error: 'Prompt is required.' });
  }

  try {
    const messages = [
      {
        role: 'system',
        content:
          'You are a hiring manager running a realistic job interview. Keep questions specific to the role the candidate mentions. Ask one question at a time. Do not give them the answer or extended coaching; stay concise and conversational.',
      },
      ...transcript.map((m) => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.content,
      })),
      { role: 'user', content: prompt.trim() },
    ];

    const completion = await openaiClient.chat.completions.create({
      model,
      temperature: 0.7,
      messages,
      max_tokens: 400,
    });

    const reply =
      completion.choices?.[0]?.message?.content?.trim() ||
      'No response received. Try again with a different prompt.';

    // TODO: persist chat turns to Mongo using req.app.locals.collections.chatLogs
    // once storage and session management are enabled.
    // TODO: forward completed exchanges to a secondary review AI for critique/scoring.

    res.json({
      reply: reply.trim(),
    });
  } catch (error) {
    console.error('OpenAI request failed:', error);
    res.status(500).json({
      error: 'OpenAI request failed. Check your API key or try again shortly.',
      detail: error?.response?.data || error.message,
    });
  }
};

module.exports = { showOpenAIPage, askOpenAI };
