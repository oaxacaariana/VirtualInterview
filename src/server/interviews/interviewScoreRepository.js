/**
 * Interview score repository.
 * Inputs: Collections plus final review data, user identifiers, and chat identifiers.
 * Outputs: Persisted and retrieved final interview score documents.
 */
const { buildInterviewScore } = require('../data/persistence');
const { normalizeInterviewScoreRecord } = require('./interviewReviewRubric');

const upsertInterviewScore = async ({
  collections,
  userId,
  sessionId,
  chatId,
  review,
}) => {
  const interviewScores = collections?.interviewScores;
  if (!interviewScores) {
    throw new Error('interviewScores unavailable');
  }

  const scoreDoc = buildInterviewScore({
    userId,
    sessionId,
    chatId,
    overallScore: review.overallScore,
    grade: review.letterGrade,
    rubric: review.categoryScores,
    summary: review.overallSummary,
    strengths: review.strengths,
    improvements: review.improvements,
    strongestArea: review.strongestArea,
    weakestArea: review.weakestArea,
    patterns: review.patterns,
    reviewedTurns: review.reviewedTurns,
  });

  await interviewScores.updateOne(
    { userId, chatId },
    {
      $set: {
        ...scoreDoc,
        createdAt: new Date(),
      },
    },
    { upsert: true }
  );

  return scoreDoc;
};

const findInterviewScoreByChatId = async ({ collections, userId, chatId }) => {
  const interviewScores = collections?.interviewScores;
  if (!interviewScores) {
    throw new Error('interviewScores unavailable');
  }

  const score = await interviewScores.findOne({ userId, chatId });
  return normalizeInterviewScoreRecord(score);
};

module.exports = {
  upsertInterviewScore,
  findInterviewScoreByChatId,
};
