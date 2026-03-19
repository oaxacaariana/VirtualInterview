export const createEmptyContext = () => ({
  company: '',
  role: '',
  resumeId: '',
  silly: false,
  seriousness: 0.5,
  style: 0.5,
  difficulty: 0.5,
  customTone: '',
});

export const createInitialState = () => ({
  history: [],
  context: createEmptyContext(),
  contextSet: false,
  interviewComplete: false,
  chatId: '',
});

export const replaceState = (state, nextState) => {
  state.history.length = 0;
  (nextState.history || []).forEach((message) => state.history.push(message));
  state.context = nextState.context || createEmptyContext();
  state.contextSet = !!nextState.contextSet;
  state.interviewComplete = !!nextState.interviewComplete;
  state.chatId = nextState.chatId || '';
};
