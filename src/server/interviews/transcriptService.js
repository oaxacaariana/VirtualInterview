/**
 * Transcript persistence service.
 * Inputs: Chat transcript state, identifiers, generated replies, and Mongo collections.
 * Outputs: Persisted turn records with fallback transcript writes if the primary write fails.
 */
const { upsertChatTranscript, insertFallbackTranscript } = require('./chatRepository');

const persistInterviewTurn = async ({
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
  try {
    const { upsertResult, turnDoc } = await upsertChatTranscript({
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
    });

    if (!upsertResult.matchedCount && !upsertResult.upsertedCount) {
      console.warn('chatLog upsert neither matched nor upserted', { chatId, userId });
    }

    return turnDoc;
  } catch (err) {
    console.error('Failed to persist chat log:', err);
    try {
      await insertFallbackTranscript({
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
      });
    } catch (fallbackError) {
      console.error('Fallback insert for chat log also failed:', fallbackError);
    }
    return null;
  }
};

module.exports = {
  persistInterviewTurn,
};
