/**
 * Chat repository.
 * Inputs: Collections, chat identifiers, user identifiers, transcripts, and turn metadata.
 * Outputs: Persisted and retrieved chat log and chat turn records.
 */
const { buildChatLog, buildChatTurn } = require('../data/persistence');

const upsertChatTranscript = async ({
  collections,
  userId,
  sessionId,
  chatId,
  model,
  transcript,
  context,
  questionAsked,
  prompt,
  reply,
  review,
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
    context,
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
    questionAsked,
    prompt: prompt.trim(),
    reply,
    review,
  });

  const insertResult = await chatTurns.insertOne(turnDoc);
  return {
    upsertResult,
    turnDoc: {
      ...turnDoc,
      _id: insertResult.insertedId,
    },
  };
};

const insertFallbackTranscript = async ({
  collections,
  userId,
  sessionId,
  chatId,
  model,
  transcript,
  context,
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
    context: {
      resumeId: context?.resumeId || null,
      company: context?.company || '',
      role: context?.role || '',
      mode: context?.mode || 'operating',
      modeLabel: context?.modeLabel || '',
      personaId: context?.personaId || '',
      personaLabel: context?.personaLabel || '',
      personaSummary: context?.personaSummary || '',
      personaPromptStyle: context?.personaPromptStyle || '',
      interviewerName: context?.interviewerName || '',
      ttsVoice: context?.ttsVoice || '',
      ttsInstructions: context?.ttsInstructions || '',
      gradingProfile: context?.gradingProfile || '',
      scrutinyProfile: context?.scrutinyProfile || '',
      silly: !!context?.silly,
      customTone: context?.customTone || '',
      seriousness: context?.seriousness ?? 0.5,
      style: context?.style ?? 0.5,
      difficulty: context?.difficulty ?? 0.5,
      complexity: context?.complexity ?? 0.5,
      webSearchEnabled: context?.webSearchEnabled !== false,
    },
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

const findChatLogByChatId = async ({ collections, chatId, userId }) => {
  const chatLogs = collections?.chatLogs;
  if (!chatLogs) {
    throw new Error('chatLogs unavailable');
  }

  return chatLogs.findOne({ chatId, userId });
};

const listChatTurnsForChat = async ({ collections, chatId, userId }) => {
  const chatTurns = collections?.chatTurns;
  if (!chatTurns) {
    throw new Error('chatTurns unavailable');
  }

  return chatTurns
    .find({ chatId, userId })
    .sort({ turn: 1, createdAt: 1 })
    .toArray();
};

const updateChatTurnReview = async ({ collections, chatId, userId, turn, review }) => {
  const chatTurns = collections?.chatTurns;
  if (!chatTurns) {
    throw new Error('chatTurns unavailable');
  }

  return chatTurns.updateOne(
    { chatId, userId, turn },
    {
      $set: {
        review,
        reviewedAt: new Date(),
      },
    }
  );
};

const findChatTurnByTurn = async ({ collections, chatId, userId, turn }) => {
  const chatTurns = collections?.chatTurns;
  if (!chatTurns) {
    throw new Error('chatTurns unavailable');
  }

  return chatTurns.findOne({ chatId, userId, turn });
};

module.exports = {
  upsertChatTranscript,
  insertFallbackTranscript,
  markChatClosed,
  listRecentChatsForUser,
  findChatLogByChatId,
  listChatTurnsForChat,
  updateChatTurnReview,
  findChatTurnByTurn,
};
