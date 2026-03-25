const STATE_KEY = 'vi_mock_chat_state';

export const saveState = (state) => {
  try {
    localStorage.setItem(
      STATE_KEY,
      JSON.stringify({
        history: state.history,
        context: state.context,
        contextSet: state.contextSet,
        interviewComplete: state.interviewComplete,
        chatId: state.chatId,
        turnAnalyses: state.turnAnalyses,
        finalReview: state.finalReview,
        lastActivityAt: state.lastActivityAt,
        coachBlurred: state.coachBlurred,
      })
    );
  } catch (error) {
    console.warn('Persist failed', error);
  }
};

export const loadState = () => {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    console.warn('Hydrate failed', error);
    return null;
  }
};

export const clearState = () => {
  localStorage.removeItem(STATE_KEY);
};
