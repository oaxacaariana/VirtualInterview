/**
 * Interview frontend entry module.
 * Inputs: DOM nodes, browser events, persisted local state, and interview API responses.
 * Outputs: A fully wired interview UI with chat flow, modal setup, persistence, and inactivity handling.
 */
import { startInterview, askInterview, closeInterview, getTurnReview } from './api.js';
import { createChatView } from './chatView.js';
import { createContextModal } from './contextModal.js';
import { createInitialState, createEmptyContext, replaceState } from './state.js';
import { saveState, loadState, clearState } from './storage.js';
import { createVoiceInput } from './voiceInput.js';
import { createTTS } from './tts.js';
import { createEyeTracking } from './eyeTracking.js';

const interviewConfig = window.__INTERVIEW_CONFIG__ || {};
const personaById = Object.fromEntries((interviewConfig.personas || []).map((persona) => [persona.id, persona]));

const avatarContainer = document.getElementById('avatar-container');
const cameraFeed = document.getElementById('camera-feed');
const cameraPlaceholder = document.getElementById('camera-placeholder');
const stageLiveBadge = document.getElementById('stage-live-badge');
const subtitleEl = document.getElementById('iv-subtitle-text');
const chatPanel = document.getElementById('iv-chat-panel');
const coachPanel = document.getElementById('iv-coach-panel');
const toggleChatBtn = document.getElementById('iv-toggle-chat');
const toggleCoachBtn = document.getElementById('iv-toggle-coach');
const eyeTrackingSpot = document.getElementById('eye-tracking-spot');
const cameraToggleBtn = document.getElementById('iv-toggle-camera');
const recalibrateBtn = document.getElementById('iv-recalibrate');
const muteBtn = document.getElementById('iv-toggle-mute');
const interviewBootOverlay = document.getElementById('interview-boot-overlay');
const interviewerNameEl = document.getElementById('iv-interviewer-name');
const interviewerBadgeEl = document.getElementById('iv-interviewer-badge');
const calibrationOverlay = document.getElementById('eye-calibration-overlay');
const calibrationCancelBtn = document.getElementById('eye-calibration-cancel');
const calibrationPoints = [...document.querySelectorAll('.eye-calibration-point')];

let assistantAudioPlaying = false;
let eyeTracking = null;

const lottiePLayer = document.getElementById('aria-lottie');

const setAvatarTalking = (talking) => {
  avatarContainer?.classList.toggle('is-talking', talking);
  if (lottiePLayer) {
    lottiePLayer.setSpeed(talking ? 1.6 : 0.8);
  }
};

const tts = createTTS({
  onStart: () => {
    assistantAudioPlaying = true;
    setAvatarTalking(true);
    eyeTracking?.syncMeasurementWindow();
  },
  onEnd: () => {
    assistantAudioPlaying = false;
    setAvatarTalking(false);
    eyeTracking?.syncMeasurementWindow();
  },
});

const syncMuteBtn = () => {
  if (!muteBtn) return;
  const muted = tts.isMuted();
  muteBtn.classList.toggle('is-active', !muted);
  muteBtn.title = muted ? 'Unmute Aria' : 'Mute Aria';
  const slash = muteBtn.querySelector('.mute-slash');
  if (slash) {
    slash.style.display = muted ? 'block' : 'none';
  }
};

muteBtn?.addEventListener('click', () => {
  tts.setMuted(!tts.isMuted());
  syncMuteBtn();
});

syncMuteBtn();

let subtitleTimer = null;

const setSubtitle = (text) => {
  if (!subtitleEl) return;
  clearTimeout(subtitleTimer);
  subtitleEl.classList.remove('is-visible');
  if (!text) return;
  void subtitleEl.offsetHeight;
  subtitleEl.textContent = text;
  subtitleEl.classList.add('is-visible');
};

const setSubtitleThinking = () => {
  if (!subtitleEl) return;
  subtitleEl.classList.remove('is-visible');
  void subtitleEl.offsetHeight;
  subtitleEl.innerHTML = '<span class="iv-subtitle-thinking"><span></span><span></span><span></span></span>';
  subtitleEl.classList.add('is-visible');
};

const clearSubtitle = () => {
  if (!subtitleEl) return;
  subtitleEl.classList.remove('is-visible');
  subtitleTimer = window.setTimeout(() => {
    subtitleEl.textContent = '';
  }, 400);
};

const openPanel = (panel, btn) => {
  [chatPanel, coachPanel].forEach((candidate) => {
    if (candidate && candidate !== panel) {
      candidate.classList.remove('is-open');
      candidate.setAttribute('aria-hidden', 'true');
    }
  });

  [toggleChatBtn, toggleCoachBtn].forEach((candidate) => {
    if (candidate && candidate !== btn) {
      candidate.classList.remove('is-active');
    }
  });

  if (!panel) return;
  const isOpen = panel.classList.contains('is-open');
  panel.classList.toggle('is-open', !isOpen);
  panel.setAttribute('aria-hidden', String(isOpen));
  btn?.classList.toggle('is-active', !isOpen);
};

toggleChatBtn?.addEventListener('click', () => openPanel(chatPanel, toggleChatBtn));
toggleCoachBtn?.addEventListener('click', () => openPanel(coachPanel, toggleCoachBtn));

document.getElementById('iv-chat-close')?.addEventListener('click', () => {
  chatPanel?.classList.remove('is-open');
  chatPanel?.setAttribute('aria-hidden', 'true');
  toggleChatBtn?.classList.remove('is-active');
});

document.getElementById('iv-coach-close')?.addEventListener('click', () => {
  coachPanel?.classList.remove('is-open');
  coachPanel?.setAttribute('aria-hidden', 'true');
  toggleCoachBtn?.classList.remove('is-active');
});

const elements = {
  chatLog: document.getElementById('chat-log'),
  form: document.getElementById('ai-form'),
  promptInput: document.getElementById('prompt'),
  statusDot: document.getElementById('ai-status'),
  setupBtn: document.getElementById('setup-btn'),
  contextBtn: document.getElementById('context-btn'),
  endBtn: document.getElementById('end-btn'),
  sendBtn: document.getElementById('send-btn'),
  micBtn: document.getElementById('mic-btn'),
  micStatus: document.getElementById('mic-status'),
  contextModal: document.getElementById('context-modal'),
  closeModal: document.getElementById('close-modal'),
  contextForm: document.getElementById('context-form'),
  contextSubmit: document.getElementById('context-submit'),
  contextModalTitle: document.getElementById('context-modal-title'),
  contextModalSubtitle: document.getElementById('context-modal-subtitle'),
  ctxCompany: document.getElementById('ctx-company'),
  ctxRole: document.getElementById('ctx-role'),
  ctxResume: document.getElementById('ctx-resume'),
  ctxWebSearch: document.getElementById('ctx-web-search'),
  ctxModeOperating: document.getElementById('ctx-mode-operating'),
  ctxModeCrazy: document.getElementById('ctx-mode-crazy'),
  ctxPersona: document.getElementById('ctx-persona'),
  ctxVoice: document.getElementById('ctx-voice'),
  ctxCustomTone: document.getElementById('ctx-custom-tone'),
  ctxSeriousness: document.getElementById('ctx-seriousness'),
  ctxStyle: document.getElementById('ctx-style'),
  ctxDifficulty: document.getElementById('ctx-difficulty'),
  ctxComplexity: document.getElementById('ctx-complexity'),
  seriousnessVal: document.getElementById('seriousness-val'),
  styleVal: document.getElementById('style-val'),
  difficultyVal: document.getElementById('difficulty-val'),
  complexityVal: document.getElementById('complexity-val'),
  resumeCards: [...document.querySelectorAll('.resume-card')],
  personaCards: [...document.querySelectorAll('.persona-card')],
  operatingModeBlock: document.getElementById('operating-mode-block'),
  personaModeBlock: document.getElementById('persona-mode-block'),
  crazyModeBlock: document.getElementById('crazy-mode-block'),
  analysisPanel: document.getElementById('analysis-panel'),
  finalScorePanel: document.getElementById('final-score-panel'),
  liveEngagementPanel: document.getElementById('live-engagement-panel'),
  finalEngagementPanel: document.getElementById('final-engagement-panel'),
  analysisPrivacyBtn: document.getElementById('analysis-privacy-btn'),
  toggleChatBtn,
  toggleCoachBtn,
  coachTabLive: document.getElementById('coach-tab-live'),
  coachTabFinal: document.getElementById('coach-tab-final'),
  coachTabPanelLive: document.getElementById('coach-tabpanel-live'),
  coachTabPanelFinal: document.getElementById('coach-tabpanel-final'),
  completeBanner: document.getElementById('interview-complete-banner'),
  completeNewChatBtn: document.getElementById('interview-complete-new-chat'),
  contextFeedback: document.getElementById('context-modal-feedback'),
};

const state = createInitialState();
const chatView = createChatView(elements);
const contextModal = createContextModal(elements);
const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000;
const ACTIVITY_PERSIST_INTERVAL_MS = 15 * 1000;
let inactivityTimer = null;
let lastPersistedActivityAt = 0;
let interviewBootLoading = false;

createVoiceInput({
  micBtn: elements.micBtn,
  micStatus: elements.micStatus,
  promptInput: elements.promptInput,
  onDraftUpdate: ({ text, status }) => {
    chatView.setDraftMessage({ text, status });
  },
  onDraftClear: () => {
    chatView.clearDraftMessage();
  },
});

const newChatId = () => {
  if (window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const persist = () => saveState(state);
const hasInterviewVisible = () => state.history.length > 0 || !!state.finalReview;
const hasStartedInterview = () => state.history.length > 0;
const hasActiveInterview = () => !!(hasStartedInterview() && state.chatId && state.contextSet && !state.interviewComplete);
const getLastHistoryRole = () => state.history[state.history.length - 1]?.role || '';

eyeTracking = createEyeTracking({
  cameraFeed,
  cameraPlaceholder,
  stageLiveBadge,
  eyeTrackingSpot,
  cameraToggleBtn,
  recalibrateBtn,
  calibrationOverlay,
  calibrationCancelBtn,
  calibrationPoints,
  shouldMeasure: () =>
    hasActiveInterview() &&
    !interviewBootLoading &&
    !assistantAudioPlaying &&
    getLastHistoryRole() === 'assistant',
  onMetricChange: (metric) => {
    chatView.setScreenEngagementMetric(metric);
  },
});

const syncScreenEngagementTracking = () => {
  eyeTracking?.syncMeasurementWindow();
};

const mergeResolvedContext = (payload = {}) => {
  const keys = [
    'mode',
    'modeLabel',
    'personaId',
    'personaLabel',
    'personaSummary',
    'personaPromptStyle',
    'interviewerName',
    'ttsVoice',
    'ttsInstructions',
    'gradingProfile',
    'scrutinyProfile',
    'silly',
    'customTone',
    'seriousness',
    'style',
    'difficulty',
    'complexity',
    'webSearchEnabled',
  ];

  keys.forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(payload, key)) {
      state.context[key] = payload[key];
    }
  });
};

const syncInterviewerPresentation = () => {
  const persona = personaById[state.context.personaId] || null;
  const interviewerName = state.context.interviewerName || persona?.interviewerName || 'Dorian';
  const interviewerBadge = state.context.personaLabel || persona?.label || 'Skeptical Manager';

  if (interviewerNameEl) {
    interviewerNameEl.textContent = interviewerName;
  }
  if (interviewerBadgeEl) {
    interviewerBadgeEl.textContent = interviewerBadge;
  }
};

const syncInteractiveControls = () => {
  const canRespond = hasStartedInterview() && !state.interviewComplete && !interviewBootLoading;

  if (elements.promptInput) {
    elements.promptInput.disabled = !canRespond;
  }
  if (elements.sendBtn) {
    elements.sendBtn.disabled = !canRespond;
  }
  if (elements.micBtn) {
    elements.micBtn.disabled = !canRespond;
  }
  if (elements.endBtn) {
    elements.endBtn.disabled = !hasStartedInterview() || state.interviewComplete || interviewBootLoading;
  }
  if (elements.setupBtn) {
    elements.setupBtn.disabled = !hasInterviewVisible() || interviewBootLoading;
  }
  if (elements.contextBtn) {
    elements.contextBtn.disabled = interviewBootLoading;
  }
};

const syncSetupModalState = () => {
  contextModal.setDismissible(hasActiveInterview() && !interviewBootLoading);
};

const setInterviewBootLoading = (loading) => {
  interviewBootLoading = loading;
  if (interviewBootOverlay) {
    interviewBootOverlay.classList.toggle('hidden', !loading);
    interviewBootOverlay.setAttribute('aria-hidden', String(!loading));
  }
  syncInteractiveControls();
  syncSetupModalState();
  syncScreenEngagementTracking();
};

const markActivity = () => {
  state.lastActivityAt = Date.now();
  lastPersistedActivityAt = state.lastActivityAt;
  persist();
};

const clearInactivityTimer = () => {
  if (inactivityTimer) {
    window.clearTimeout(inactivityTimer);
    inactivityTimer = null;
  }
};

const scheduleInactivityTimeout = () => {
  clearInactivityTimer();
  if (!hasActiveInterview() || !state.lastActivityAt) {
    return;
  }

  const remaining = INACTIVITY_TIMEOUT_MS - (Date.now() - state.lastActivityAt);
  if (remaining <= 0) {
    void expireInterviewForInactivity();
    return;
  }

  inactivityTimer = window.setTimeout(() => {
    void expireInterviewForInactivity();
  }, remaining);
};

const countUserTurns = (history) => history.filter((message) => message.role === 'user').length;

const addUserMessage = (content, turnNumber) => {
  const bubble = chatView.addMessage('user', content, {
    onSelect: () =>
      chatView.showTurnAnalysis({
        analysis: state.turnAnalyses[String(turnNumber)] || null,
        answer: content,
      }),
  });

  const analysis = state.turnAnalyses[String(turnNumber)];
  if (analysis) {
    chatView.attachInlineAnalysis(bubble, analysis);
  }

  return bubble;
};

const addAssistantMessage = (content, options = {}) => {
  chatView.addMessage('assistant', content);
  const shouldShowSubtitle = options.subtitle !== false;
  const shouldSpeak = options.speak !== false;
  let speechPromise = Promise.resolve();

  if (shouldShowSubtitle) {
    setSubtitle(content);
  }
  if (shouldSpeak) {
    speechPromise = Promise.resolve(
      tts.play(content, {
        voice: state.context.ttsVoice,
        instructions: state.context.ttsInstructions,
      })
    ).catch(() => {});
  }
  return speechPromise;
};

const openCoachForFinalReview = () => {
  chatPanel?.classList.remove('is-open');
  chatPanel?.setAttribute('aria-hidden', 'true');
  toggleChatBtn?.classList.remove('is-active');
  coachPanel?.classList.add('is-open');
  coachPanel?.setAttribute('aria-hidden', 'false');
  toggleCoachBtn?.classList.add('is-active');
  chatView.setCoachTab('final');
};

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const normalizeMessageText = (value) => String(value || '').replace(/\s+/g, ' ').trim();
const getCompletionSettleDelay = (text = '') => {
  const normalized = normalizeMessageText(text);
  if (!normalized) {
    return 1200;
  }

  return Math.max(1600, Math.min(5200, 900 + normalized.length * 18));
};

const watchTurnAnalysis = async ({ chatId, turnNumber, answer, bubble }) => {
  for (let attempt = 0; attempt < 16; attempt += 1) {
    try {
      const result = await getTurnReview(chatId, turnNumber);
      if (state.chatId !== chatId) {
        return;
      }
      if (result.ready && result.review) {
        state.turnAnalyses[String(turnNumber)] = result.review;
        chatView.attachInlineAnalysis(bubble, result.review);
        chatView.showTurnAnalysis({
          analysis: result.review,
          answer,
        });
        persist();
        return;
      }
    } catch (error) {
      console.warn('Turn review polling failed:', error);
      return;
    }

    await wait(attempt < 3 ? 500 : 1000);
  }
};

const setThinking = (thinking) => {
  chatView.setStatus(thinking ? 'Thinking...' : 'Ready', thinking);
  if (thinking) {
    tts.stop();
    setSubtitleThinking();
  }
};

const resetChat = () => {
  clearInactivityTimer();
  tts.stop();
  clearSubtitle();
  eyeTracking?.resetMetric();
  chatView.clearMessages();
  replaceState(state, createInitialState());
  state.context = createEmptyContext();
  chatView.setInterviewComplete(false);
  chatView.setIdleAnalysis();
  chatView.setFinalPlaceholder();
  clearState();
  contextModal.populate(state.context);
  contextModal.setFeedback('');
  contextModal.setBusy(false);
  contextModal.setMode('edit');
  chatView.setCoachBlurred(state.coachBlurred);
  chatView.setCoachTab('live');
  setInterviewBootLoading(false);
  chatView.setStatus('Set up interview', false);
  syncInterviewerPresentation();
  syncScreenEngagementTracking();
};

const hydrate = () => {
  const saved = loadState();
  if (!saved) {
    return false;
  }

  replaceState(state, saved);
  if (!state.chatId) {
    state.chatId = newChatId();
  }

  chatView.clearMessages();
  if (!hasInterviewVisible()) {
    contextModal.populate(state.context);
    contextModal.setFeedback('');
    contextModal.setBusy(false);
    contextModal.setMode('edit');
    chatView.setInterviewComplete(false);
    chatView.setIdleAnalysis();
    chatView.setFinalPlaceholder();
    chatView.setCoachBlurred(state.coachBlurred);
    chatView.setCoachTab('live');
    clearSubtitle();
    contextModal.open();
    chatView.setStatus('Set up interview', false);
    syncInterviewerPresentation();
    syncSetupModalState();
    syncInteractiveControls();
    syncScreenEngagementTracking();
    return true;
  }

  let turnNumber = 0;
  state.history.forEach((message) => {
    if (message.role === 'user') {
      turnNumber += 1;
      addUserMessage(message.content, turnNumber);
      return;
    }

    addAssistantMessage(message.content, { speak: false, subtitle: false });
  });

  const latestAssistantMessage = [...state.history].reverse().find((message) => message.role === 'assistant');
  if (latestAssistantMessage) {
    setSubtitle(latestAssistantMessage.content);
  }

  contextModal.populate(state.context);
  contextModal.setFeedback('');
  contextModal.setBusy(false);
  contextModal.setMode('view');
  chatView.setInterviewComplete(state.interviewComplete);
  chatView.setCoachBlurred(state.coachBlurred);
  if (state.finalReview) {
    chatView.showFinalReview(state.finalReview);
    chatView.setCoachTab('final');
  } else {
    chatView.setIdleAnalysis();
    chatView.setFinalPlaceholder();
  }
  contextModal.close();
  syncInterviewerPresentation();
  syncSetupModalState();
  syncInteractiveControls();
  scheduleInactivityTimeout();
  syncScreenEngagementTracking();
  return true;
};

const completeInterview = async (assistantMessage, options = {}) => {
  clearInactivityTimer();
  state.interviewComplete = true;
  syncInteractiveControls();
  syncSetupModalState();

  let settlePromise = options.settlePromise || Promise.resolve();
  const settleText = options.settleText || assistantMessage || '';

  if (assistantMessage) {
    settlePromise = addAssistantMessage(assistantMessage);
    state.history.push({ role: 'assistant', content: assistantMessage });
  }

  syncScreenEngagementTracking();

  await Promise.all([
    Promise.resolve(settlePromise).catch(() => {}),
    wait(getCompletionSettleDelay(settleText)),
  ]);

  chatView.setInterviewComplete(true);
  syncInteractiveControls();
  syncSetupModalState();
  openCoachForFinalReview();
  if (countUserTurns(state.history) === 0) {
    state.finalReview = null;
    chatView.showFinalReview(null);
    chatView.setCoachTab('final');
    persist();
    return;
  }
  chatView.setFinalLoading();
  try {
    const closeResult = await closeInterview(state.chatId);
    state.finalReview = closeResult?.finalReview || null;
    if (state.finalReview) {
      chatView.showFinalReview(state.finalReview);
      chatView.setCoachTab('final');
    }
  } catch (error) {
    addAssistantMessage(`Final review failed: ${error.message}`);
  }
  persist();
};

const expireInterviewForInactivity = async () => {
  if (!hasActiveInterview()) {
    clearInactivityTimer();
    return;
  }
  await completeInterview(
    'Interview closed after 30 minutes of inactivity. Start a new session when you are ready to continue practicing.'
  );
};

elements.form.addEventListener('submit', async (event) => {
  event.preventDefault();
  tts.warmUp();
  const prompt = (elements.promptInput.value || '').trim();
  if (!prompt) {
    return;
  }

  if (!state.contextSet || !state.context.company || !state.context.role || !state.context.resumeId) {
    addAssistantMessage('Please set company, role, and pick a resume before chatting.');
    return;
  }

  if (state.interviewComplete) {
    addAssistantMessage('Interview is marked complete. Start a new session to continue.');
    return;
  }

  const priorTranscript = state.history.slice();
  const turnNumber = countUserTurns(priorTranscript) + 1;
  const userBubble = addUserMessage(prompt, turnNumber);
  state.history.push({ role: 'user', content: prompt });
  syncScreenEngagementTracking();
  markActivity();
  elements.promptInput.value = '';
  clearSubtitle();
  setThinking(true);

  try {
    const data = await askInterview({
      prompt,
      transcript: priorTranscript,
      interviewComplete: state.interviewComplete,
      chatId: state.chatId,
      ...state.context,
    });

    mergeResolvedContext(data);
    state.chatId = data.chatId || state.chatId;
    if (data.backgroundDoc) {
      state.context.backgroundDoc = data.backgroundDoc;
      state.context.resumeText = data.resumeText || '';
      state.context.jobDescription = data.jobDescription || '';
      state.context.researchSummary = data.researchSummary || '';
      state.context.webSignals = data.webSignals || '';
    }
    syncInterviewerPresentation();
    const replyPlayback = addAssistantMessage(data.reply);
    state.history.push({ role: 'assistant', content: data.reply });
    syncScreenEngagementTracking();
    markActivity();
    chatView.setIdleAnalysis();

    if (data.analysisPending) {
      void watchTurnAnalysis({
        chatId: data.chatId || state.chatId,
        turnNumber: data.turnNumber || turnNumber,
        answer: prompt,
        bubble: userBubble,
      });
    }

    if (data.interviewComplete) {
      await completeInterview(undefined, {
        settlePromise: replyPlayback,
        settleText: data.reply,
      });
    } else {
      scheduleInactivityTimeout();
    }
  } catch (error) {
    addAssistantMessage(`Something went wrong: ${error.message}`);
  } finally {
    if (!state.interviewComplete) {
      setThinking(false);
    }
  }
});

contextModal.contextForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  tts.warmUp();
  contextModal.setFeedback('');

  state.context = contextModal.read();
  state.contextSet = !!(state.context.company && state.context.role && state.context.resumeId);

  if (!state.contextSet) {
    contextModal.setFeedback('Choose a company, role, and resume before launching the interview.');
    return;
  }

  state.chatId = newChatId();
  persist();
  markActivity();
  contextModal.close({ force: true });
  contextModal.setBusy(true);
  clearSubtitle();
  chatView.setStatus('Preparing interview...', true);
  setInterviewBootLoading(true);
  try {
    const data = await startInterview({
      ...state.context,
      interviewComplete: state.interviewComplete,
      chatId: state.chatId,
    });

    if (!data?.opener) {
      throw new Error('Interview setup finished without an opening prompt. Please try again.');
    }

    mergeResolvedContext(data);
    state.chatId = data.chatId || state.chatId;
    if (data.backgroundDoc) {
      state.context.backgroundDoc = data.backgroundDoc;
      state.context.resumeText = data.resumeText || '';
      state.context.jobDescription = data.jobDescription || '';
      state.context.researchSummary = data.researchSummary || '';
      state.context.webSignals = data.webSignals || '';
    }
    syncInterviewerPresentation();
    addAssistantMessage(data.opener);
    state.history.push({ role: 'assistant', content: data.opener });
    syncScreenEngagementTracking();
    contextModal.setMode('view');
    markActivity();
    scheduleInactivityTimeout();
  } catch (error) {
    contextModal.setMode('edit');
    contextModal.setFeedback(`Error preparing interview: ${error.message}`);
    contextModal.open();
    chatView.setStatus('Setup needed', false);
  } finally {
    contextModal.setBusy(false);
    setInterviewBootLoading(false);
    if (hasStartedInterview() && !state.interviewComplete) {
      chatView.setStatus('Ready', false);
    }
    syncInteractiveControls();
    syncSetupModalState();
  }
});

elements.contextBtn.addEventListener('click', () => {
  resetChat();
  contextModal.setMode('edit');
  contextModal.open();
});

elements.setupBtn.addEventListener('click', () => {
  contextModal.populate(state.context);
  contextModal.setMode('view');
  contextModal.open();
});

elements.endBtn.addEventListener('click', async () => {
  await completeInterview('Interview marked complete. Thanks for practicing!');
});

elements.analysisPrivacyBtn?.addEventListener('click', () => {
  state.coachBlurred = !state.coachBlurred;
  chatView.setCoachBlurred(state.coachBlurred);
  persist();
});

elements.completeNewChatBtn?.addEventListener('click', () => {
  resetChat();
  contextModal.setMode('edit');
  contextModal.open();
});

['pointerdown', 'keydown'].forEach((eventName) => {
  window.addEventListener(eventName, () => {
    if (!hasActiveInterview()) {
      return;
    }
    state.lastActivityAt = Date.now();
    if (state.lastActivityAt - lastPersistedActivityAt >= ACTIVITY_PERSIST_INTERVAL_MS) {
      lastPersistedActivityAt = state.lastActivityAt;
      persist();
    }
    scheduleInactivityTimeout();
  });
});

if (!hydrate()) {
  resetChat();
  contextModal.open();
} else if (hasActiveInterview()) {
  if (state.lastActivityAt && Date.now() - state.lastActivityAt >= INACTIVITY_TIMEOUT_MS) {
    void expireInterviewForInactivity();
  } else {
    scheduleInactivityTimeout();
  }
}

chatView.setCoachBlurred(state.coachBlurred);
eyeTracking?.init();
chatView.setScreenEngagementMetric(eyeTracking?.getMetric() || null);
syncInterviewerPresentation();
syncInteractiveControls();
syncSetupModalState();
syncScreenEngagementTracking();
