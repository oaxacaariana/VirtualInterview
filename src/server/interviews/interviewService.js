/**
 * Interview orchestration service.
 * Inputs: Collections, session user state, OpenAI client, session ids, chat ids, and interview payloads.
 * Outputs: Interview openers, turn replies, turn review state, and final review results.
 */
const { ringColorForScore } = require('../shared/scoreColors');
const { interviewModel } = require('../shared/openaiClient');
const {
  toObjectId,
  listActiveResumesWithScores,
} = require('../resumes/resumeRepository');
const { loadInterviewContext } = require('./interviewContextService');
const {
  buildAskMessages,
  buildStartMessages,
  normalizeInterviewReply,
} = require('./interviewPromptBuilder');
const { persistInterviewTurn } = require('./transcriptService');
const { createTurnAnalysis, createFinalInterviewReview } = require('./reviewService');
const {
  findChatLogByChatId,
  listChatTurnsForChat,
  markChatClosed,
  updateChatTurnReview,
  findChatTurnByTurn,
} = require('./chatRepository');
const { upsertInterviewScore } = require('./interviewScoreRepository');
const { findInterviewScoreByChatId } = require('./interviewScoreRepository');

const ensureChatId = (incoming) =>
  incoming && typeof incoming === 'string' && incoming.trim().length > 0
    ? incoming.trim()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const getCachedInterviewContext = (input) => ({
  backgroundDoc: input.backgroundDoc || '',
  resumeText: input.resumeText || '',
  jobDescription: input.jobDescription || '',
  researchSummary: input.researchSummary || '',
  webSignals: input.webSignals || '',
});

const hasCompleteCachedContext = (context) =>
  !!(context.backgroundDoc && context.resumeText);

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
    webSearchEnabled: input.webSearchEnabled,
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
      complexity: input.complexity,
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
    backgroundDoc: context.backgroundDoc,
    resumeText: context.resumeText,
    jobDescription: context.jobDescription,
    researchSummary: context.researchSummary,
    webSignals: context.webSignals,
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
  const cachedContext = getCachedInterviewContext(input);
  const context = hasCompleteCachedContext(cachedContext)
      ? cachedContext
      : await loadInterviewContext({
          collections,
          sessionUser,
          openaiClient,
          resumeId: input.resumeId,
          company: input.company,
          role: input.role,
          webSearchEnabled: input.webSearchEnabled,
        });

  const questionAsked =
    [...input.transcript]
      .reverse()
      .find((message) => message.role === 'assistant')?.content || '';
  const turnNumber = input.transcript.filter((message) => message.role === 'user').length + 1;

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
      complexity: input.complexity,
      backgroundDoc: context.backgroundDoc,
    }),
    max_tokens: 400,
  });

  const replyText = completion.choices?.[0]?.message?.content?.trim();
  const normalized = normalizeInterviewReply(replyText, input.interviewComplete);
  const userId = toObjectId(sessionUser?.id);

  const turnDoc = await persistInterviewTurn({
    collections,
    userId,
    sessionId,
    chatId,
    model: interviewModel,
    transcript: input.transcript,
    context: {
      resumeId: input.resumeId,
      company: input.company,
      role: input.role,
      backgroundDoc: context.backgroundDoc,
      resumeText: context.resumeText,
      jobDescription: context.jobDescription,
      researchSummary: context.researchSummary,
      webSignals: context.webSignals,
      silly: input.silly,
      customTone: input.customTone,
      seriousness: input.seriousness,
      style: input.style,
      difficulty: input.difficulty,
      complexity: input.complexity,
      webSearchEnabled: input.webSearchEnabled,
    },
    questionAsked,
    prompt: input.prompt,
    reply: normalized.reply,
    status: normalized.interviewComplete ? 'completed' : 'in-progress',
  });

  setImmediate(async () => {
    try {
      const analysis = await createTurnAnalysis({
        openaiClient,
        turnNumber,
        company: input.company,
        role: input.role,
        backgroundDoc: context.backgroundDoc,
        questionAsked,
        candidateResponse: input.prompt,
      });

      await updateChatTurnReview({
        collections,
        chatId,
        userId,
        turn: turnNumber,
        review: analysis,
      });
    } catch (error) {
      console.warn('Turn analysis generation failed:', error.message);
    }
  });

  return {
    reply: normalized.reply.trim(),
    chatId,
    interviewComplete: normalized.interviewComplete,
    turnNumber,
    turnId: turnDoc?._id || null,
    backgroundDoc: context.backgroundDoc || input.backgroundDoc || '',
    resumeText: context.resumeText || input.resumeText || '',
    jobDescription: context.jobDescription || input.jobDescription || '',
    researchSummary: context.researchSummary || input.researchSummary || '',
    webSignals: context.webSignals || input.webSignals || '',
    analysisPending: true,
    questionAsked,
  };
};

const getTurnAnalysis = async ({
  collections,
  sessionUser,
  chatId: rawChatId,
  turn,
}) => {
  const chatId = ensureChatId(rawChatId);
  const userId = toObjectId(sessionUser?.id);
  const turnNumber = Number(turn);

  if (!Number.isInteger(turnNumber) || turnNumber <= 0) {
    const error = new Error('Invalid turn number.');
    error.status = 400;
    throw error;
  }

  const turnDoc = await findChatTurnByTurn({
    collections,
    chatId,
    userId,
    turn: turnNumber,
  });

  if (!turnDoc) {
    const error = new Error('Turn not found.');
    error.status = 404;
    throw error;
  }

  return {
    ready: !!turnDoc.review,
    turnNumber,
    review: turnDoc.review || null,
  };
};

const finalizeInterview = async ({
  collections,
  sessionUser,
  sessionId,
  openaiClient,
  chatId: rawChatId,
}) => {
  const chatId = ensureChatId(rawChatId);
  const userId = toObjectId(sessionUser?.id);
  const chatLog = await findChatLogByChatId({ collections, chatId, userId });
  if (!chatLog) {
    const error = new Error('Chat not found.');
    error.status = 404;
    throw error;
  }

  await markChatClosed({ collections, chatId, userId });

  const turns = await listChatTurnsForChat({ collections, chatId, userId });
  if (!turns.length) {
    return {
      ok: true,
      finalReview: null,
    };
  }

  const existingScore = await findInterviewScoreByChatId({
    collections,
    userId,
    chatId,
  });
  if (existingScore) {
    return {
      ok: true,
      finalReview: {
        overallScore: existingScore.overallScore,
        letterGrade: existingScore.grade,
        categoryScores: existingScore.rubric || {},
        overallSummary: existingScore.summary || '',
        strongestArea: existingScore.strongestArea || '',
        weakestArea: existingScore.weakestArea || '',
        patterns: existingScore.patterns || '',
        strengths: existingScore.strengths || [],
        improvements: existingScore.improvements || [],
        reviewedTurns: existingScore.reviewedTurns || turns.length,
      },
    };
  }

  const cachedContext = {
    resumeText: chatLog.context?.resumeText || '',
    jobDescription: chatLog.context?.jobDescription || '',
  };
  const context = cachedContext.resumeText
    ? cachedContext
    : await loadInterviewContext({
        collections,
        sessionUser,
        openaiClient,
        resumeId: chatLog.context?.resumeId,
        company: chatLog.context?.company || '',
        role: chatLog.context?.role || '',
        activeOnly: false,
        includeResearch: false,
      });

  const finalReview = await createFinalInterviewReview({
    openaiClient,
    company: chatLog.context?.company || '',
    role: chatLog.context?.role || '',
    difficulty: chatLog.context?.difficulty ?? 0.5,
    resumeText: context.resumeText,
    jobDescription: context.jobDescription,
    turns,
  });

  await upsertInterviewScore({
    collections,
    userId,
    sessionId: chatLog.sessionId || sessionId,
    chatId,
    review: finalReview,
  });

  return {
    ok: true,
    finalReview,
  };
};

module.exports = {
  ensureChatId,
  mapResumesForView,
  startInterviewSession,
  continueInterview,
  getTurnAnalysis,
  finalizeInterview,
};
