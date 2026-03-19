const { ringColorForScore } = require('../../utils/scoreColors');
const { interviewModel } = require('../../lib/openaiClient');
const {
  toObjectId,
  listActiveResumesWithScores,
} = require('../../repositories/resumeRepository');
const { loadInterviewContext } = require('./interviewContextService');
const {
  buildAskMessages,
  buildStartMessages,
  normalizeInterviewReply,
} = require('./interviewPromptBuilder');
const { persistInterviewTurn } = require('./transcriptService');

const ensureChatId = (incoming) =>
  incoming && typeof incoming === 'string' && incoming.trim().length > 0
    ? incoming.trim()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const mapResumesForView = async ({ collections, sessionUser }) => {
  const files = await listActiveResumesWithScores(collections, sessionUser);
  return files.map((file) => {
    const scoreVal = file.latestScore?.score ?? null;
    return {
      _id: file._id,
      originalName: file.originalName,
      fitScore: scoreVal,
      ringColor: ringColorForScore(scoreVal),
    };
  });
};

const startInterviewSession = async ({
  collections,
  sessionUser,
  openaiClient,
  input,
}) => {
  const chatId = ensureChatId(input.chatId);
  const context = await loadInterviewContext({
    collections,
    sessionUser,
    openaiClient,
    resumeId: input.resumeId,
    company: input.company,
    role: input.role,
  });

  const completion = await openaiClient.chat.completions.create({
    model: interviewModel,
    temperature: 0.7,
    messages: buildStartMessages({
      silly: input.silly,
      customTone: input.customTone,
      seriousness: input.seriousness,
      style: input.style,
      difficulty: input.difficulty,
      interviewComplete: input.interviewComplete,
      backgroundDoc: context.backgroundDoc,
    }),
    max_tokens: 300,
  });

  return {
    opener:
      completion.choices?.[0]?.message?.content?.trim() ||
      "Welcome-let's begin with your background.",
    chatId,
  };
};

const continueInterview = async ({
  collections,
  sessionUser,
  sessionId,
  openaiClient,
  input,
}) => {
  const chatId = ensureChatId(input.chatId);
  const context = await loadInterviewContext({
    collections,
    sessionUser,
    openaiClient,
    resumeId: input.resumeId,
    company: input.company,
    role: input.role,
  });

  const completion = await openaiClient.chat.completions.create({
    model: interviewModel,
    temperature: 0.7,
    messages: buildAskMessages({
      prompt: input.prompt,
      transcript: input.transcript,
      interviewComplete: input.interviewComplete,
      silly: input.silly,
      customTone: input.customTone,
      seriousness: input.seriousness,
      style: input.style,
      difficulty: input.difficulty,
      backgroundDoc: context.backgroundDoc,
    }),
    max_tokens: 400,
  });

  const replyText = completion.choices?.[0]?.message?.content?.trim();
  const normalized = normalizeInterviewReply(replyText, input.interviewComplete);
  const userId = toObjectId(sessionUser?.id);

  await persistInterviewTurn({
    collections,
    userId,
    sessionId,
    chatId,
    model: interviewModel,
    transcript: input.transcript,
    prompt: input.prompt,
    reply: normalized.reply,
    status: normalized.interviewComplete ? 'completed' : 'in-progress',
  });

  return {
    reply: normalized.reply.trim(),
    chatId,
    interviewComplete: normalized.interviewComplete,
  };
};

module.exports = {
  ensureChatId,
  mapResumesForView,
  startInterviewSession,
  continueInterview,
};
