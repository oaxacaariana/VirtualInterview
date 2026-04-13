/**
 * Interview frontend state helpers.
 * Inputs: Existing state objects and optional persisted state snapshots.
 * Outputs: Fresh state objects and in-place state replacement for the interview UI.
 */
export const createEmptyContext = () => ({
  company: '',
  role: '',
  resumeId: '',
  backgroundDoc: '',
  resumeText: '',
  jobDescription: '',
  researchSummary: '',
  webSignals: '',
  webSearchEnabled: true,
  silly: false,
  seriousness: 0.5,
  style: 0.5,
  difficulty: 0.5,
  complexity: 0.5,
  customTone: '',
});

export const createInitialState = () => ({
  history: [],
  context: createEmptyContext(),
  contextSet: false,
  interviewComplete: false,
  chatId: '',
  turnAnalyses: {},
  finalReview: null,
  lastActivityAt: 0,
  coachBlurred: true,
});

export const replaceState = (state, nextState) => {
  state.history.length = 0;
  (nextState.history || []).forEach((message) => state.history.push(message));
  state.context = nextState.context || createEmptyContext();
  state.contextSet = !!nextState.contextSet;
  state.interviewComplete = !!nextState.interviewComplete;
  state.chatId = nextState.chatId || '';
  state.turnAnalyses = nextState.turnAnalyses || {};
  state.finalReview = nextState.finalReview || null;
  state.lastActivityAt = Number(nextState.lastActivityAt) || 0;
  state.coachBlurred = Object.prototype.hasOwnProperty.call(nextState || {}, 'coachBlurred')
    ? !!nextState.coachBlurred
    : true;
};
