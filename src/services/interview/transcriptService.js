const { upsertChatTranscript, insertFallbackTranscript } = require('../../repositories/chatRepository');

const persistInterviewTurn = async ({
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
  try {
    const upsertResult = await upsertChatTranscript({
      collections,
      userId,
      sessionId,
      chatId,
      model,
      transcript,
      prompt,
      reply,
      status,
    });

    if (!upsertResult.matchedCount && !upsertResult.upsertedCount) {
      console.warn('chatLog upsert neither matched nor upserted', { chatId, userId });
    }
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
        prompt,
        reply,
        status,
      });
    } catch (fallbackError) {
      console.error('Fallback insert for chat log also failed:', fallbackError);
    }
  }
};

module.exports = {
  persistInterviewTurn,
};
