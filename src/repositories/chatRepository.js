const { buildChatLog, buildChatTurn } = require('../db/persistence');

const upsertChatTranscript = async ({
  collections,
  userId,
  sessionId,
  chatId,
  model,
  transcript,
  prompt,
  reply,
  status,
}) => {
  const chatLogs = collections?.chatLogs;
  const chatTurns = collections?.chatTurns;

  if (!chatLogs || !chatTurns) {
    throw new Error('Chat collections missing');
  }

  const userTurns = transcript.filter((message) => message.role === 'user').length;
  const log = buildChatLog({
    userId,
    sessionId,
    chatId,
    model,
    messages: [
      ...transcript,
      { role: 'user', content: prompt.trim(), at: new Date() },
      { role: 'assistant', content: reply, at: new Date() },
    ],
    status,
  });

  log.updatedAt = new Date();
  const { createdAt, ...logFields } = log;

  const upsertResult = await chatLogs.updateOne(
    { chatId, userId },
    { $set: logFields, $setOnInsert: { createdAt: createdAt || new Date() } },
    { upsert: true }
  );

  const turnDoc = buildChatTurn({
    userId,
    sessionId,
    chatId,
    model,
    turn: userTurns + 1,
    prompt: prompt.trim(),
    reply,
  });

  await chatTurns.insertOne(turnDoc);
  return upsertResult;
};

const insertFallbackTranscript = async ({
  collections,
  userId,
  sessionId,
  chatId,
  model,
  transcript,
  prompt,
  reply,
  status,
}) => {
  const chatLogs = collections?.chatLogs;
  if (!chatLogs) return;

  await chatLogs.insertOne({
    type: 'transcript',
    chatId,
    userId,
    sessionId,
    model,
    status,
    messages: [
      ...transcript,
      { role: 'user', content: prompt.trim(), at: new Date() },
      { role: 'assistant', content: reply, at: new Date() },
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
  });
};

const markChatClosed = async ({ collections, chatId, userId }) => {
  const chatLogs = collections?.chatLogs;
  if (!chatLogs) {
    throw new Error('Chat log store unavailable');
  }

  return chatLogs.updateOne(
    { chatId, userId },
    { $set: { status: 'completed', updatedAt: new Date(), closedAt: new Date() } }
  );
};

const listRecentChatsForUser = async ({ collections, userId, limit = 20 }) => {
  const chatLogs = collections?.chatLogs;
  if (!chatLogs) {
    throw new Error('chatLogs unavailable');
  }

  return chatLogs
    .find({ userId })
    .sort({ updatedAt: -1 })
    .limit(limit)
    .project({ messages: 0 })
    .toArray();
};

module.exports = {
  upsertChatTranscript,
  insertFallbackTranscript,
  markChatClosed,
  listRecentChatsForUser,
};
