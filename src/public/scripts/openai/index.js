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
const muteBtn = document.getElementById('iv-toggle-mute');

const setAvatarTalking = (talking) => {
  avatarContainer?.classList.toggle('is-talking', talking);
};

const tts = createTTS({
  onStart: () => setAvatarTalking(true),
  onEnd: () => setAvatarTalking(false),
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

const promptForEyeTracking = async () => {
  if (!window.webgazer) {
    return false;
  }

  const cachedChoice = sessionStorage.getItem('iv-eye-tracking-choice');
  if (cachedChoice) {
    return cachedChoice === 'yes';
  }

  const savedChoice = localStorage.getItem('iv-eye-tracking');
  if (savedChoice === 'yes' || savedChoice === 'on') {
    sessionStorage.setItem('iv-eye-tracking-choice', 'yes');
    return true;
  }
  if (savedChoice === 'no' || savedChoice === 'off') {
    sessionStorage.setItem('iv-eye-tracking-choice', 'no');
    return false;
  }

  if (window.Swal?.fire) {
    const result = await window.Swal.fire({
      title: 'Track Eye Movement',
      text: 'Would you like to track eye movement during your interview to receive feedback on your eye contact?',
      showCancelButton: true,
      showConfirmButton: true,
      cancelButtonText: 'No',
      confirmButtonText: 'Yes',
      background: 'linear-gradient(180deg, rgba(20,23,32,0.96), rgba(15,15,16,0.98))',
      color: '#dbeafe',
      titleColor: '#93c5fd',
      customClass: {
        confirmButton: 'swal-btn-confirm',
        cancelButton: 'swal-btn-cancel',
      },
      buttonsStyling: false,
    });

    sessionStorage.setItem('iv-eye-tracking-choice', result.isConfirmed ? 'yes' : 'no');
    return result.isConfirmed;
  }

  const accepted = window.confirm(
    'Track eye movement during your interview to receive feedback on your eye contact?'
  );
  sessionStorage.setItem('iv-eye-tracking-choice', accepted ? 'yes' : 'no');
  return accepted;
};

let cameraStream = null;
let cameraEnabled = localStorage.getItem('iv-camera') !== 'off';
let eyeTrackingEnabled = localStorage.getItem('iv-eye-tracking') !== 'off';
let webgazerInitialized = false;
let eyeContactTotal = 0;
let eyeContactHits = 0;

const setEyeTrackingState = (active, focused = null) => {
  if (!eyeTrackingSpot) return;
  eyeTrackingSpot.classList.toggle('is-active', active);
  eyeTrackingSpot.classList.toggle('is-focused', focused === true);
  eyeTrackingSpot.classList.toggle('is-missed', focused === false);
};

const isOverlap = (xPos, yPos) => {
  const rect = eyeTrackingSpot?.getBoundingClientRect();
  if (!rect) return false;
  return xPos >= rect.left && xPos <= rect.right && yPos >= rect.top && yPos <= rect.bottom;
};

const updateEyeTrackingBadge = () => {
  if (!stageLiveBadge) return;
  if (!cameraStream) {
    stageLiveBadge.removeAttribute('data-eye-score');
    return;
  }

  if (!eyeTrackingEnabled || !eyeContactTotal) {
    stageLiveBadge.removeAttribute('data-eye-score');
    return;
  }

  stageLiveBadge.setAttribute('data-eye-score', `${Math.round((eyeContactHits / eyeContactTotal) * 100)}% eye`);
};

const pauseEyeTracking = () => {
  setEyeTrackingState(false);
  if (!window.webgazer || !webgazerInitialized) {
    updateEyeTrackingBadge();
    return;
  }

  try {
    window.webgazer.pause();
  } catch {
    // no-op
  }

  updateEyeTrackingBadge();
};

const startEyeTracking = async () => {
  if (!window.webgazer || !eyeTrackingEnabled) {
    return;
  }

  try {
    if (!webgazerInitialized) {
      window.webgazer.params.faceMeshBasePath = '/mediapipe/face_mesh/';
      await window.webgazer
        .setRegression('ridge')
        .setGazeListener((data) => {
          if (!data || !cameraStream) return;

          eyeContactTotal += 1;
          const focused = isOverlap(data.x, data.y);
          if (focused) {
            eyeContactHits += 1;
          }
          setEyeTrackingState(true, focused);
          updateEyeTrackingBadge();
        })
        .saveDataAcrossSessions(true)
        .begin();

      window.webgazer
        .showVideoPreview(false)
        .showPredictionPoints(false)
        .applyKalmanFilter(true)
        .showFaceOverlay(false)
        .showFaceFeedbackBox(false);

      webgazerInitialized = true;
    } else {
      await window.webgazer.resume();
    }

    setEyeTrackingState(true);
  } catch (error) {
    console.warn('Eye tracking failed to start:', error);
    eyeTrackingEnabled = false;
    localStorage.setItem('iv-eye-tracking', 'off');
    setEyeTrackingState(false);
    updateEyeTrackingBadge();
  }
};

const setCameraUI = (on) => {
  if (cameraFeed) cameraFeed.classList.toggle('hidden', !on);
  if (cameraPlaceholder) cameraPlaceholder.classList.toggle('hidden', on);
  if (stageLiveBadge) stageLiveBadge.style.display = on ? '' : 'none';
  if (cameraToggleBtn) {
    cameraToggleBtn.classList.toggle('is-active', on);
    cameraToggleBtn.title = on ? 'Turn camera off' : 'Turn camera on';
  }
  if (!on) {
    setEyeTrackingState(false);
  }
  updateEyeTrackingBadge();
};

const stopCamera = () => {
  cameraStream?.getTracks().forEach((track) => track.stop());
  cameraStream = null;
  if (cameraFeed) {
    cameraFeed.srcObject = null;
  }
  pauseEyeTracking();
  setCameraUI(false);
};

const startCamera = async () => {
  if (!navigator.mediaDevices?.getUserMedia) {
    setCameraUI(false);
    return;
  }

  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    if (cameraFeed) {
      cameraFeed.srcObject = cameraStream;
    }
    setCameraUI(true);

    const shouldTrackEyes = await promptForEyeTracking();
    eyeTrackingEnabled = shouldTrackEyes;
    localStorage.setItem('iv-eye-tracking', shouldTrackEyes ? 'on' : 'off');

    if (shouldTrackEyes) {
      await startEyeTracking();
    } else {
      setEyeTrackingState(false);
      updateEyeTrackingBadge();
    }
  } catch (error) {
    console.warn('Camera failed to start:', error);
    setCameraUI(false);
  }
};

cameraToggleBtn?.addEventListener('click', async () => {
  cameraEnabled = !cameraEnabled;
  localStorage.setItem('iv-camera', cameraEnabled ? 'on' : 'off');
  if (cameraEnabled) {
    await startCamera();
  } else {
    stopCamera();
  }
});

if (cameraEnabled) {
  void startCamera();
} else {
  setCameraUI(false);
}

window.addEventListener('beforeunload', () => {
  stopCamera();
  if (window.webgazer && webgazerInitialized) {
    try {
      window.webgazer.end();
    } catch {
      // no-op
    }
  }
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
  ctxSilly: document.getElementById('ctx-silly'),
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
  analysisPanel: document.getElementById('analysis-panel'),
  finalScorePanel: document.getElementById('final-score-panel'),
  analysisPrivacyBtn: document.getElementById('analysis-privacy-btn'),
};

const state = createInitialState();
const chatView = createChatView(elements);
const contextModal = createContextModal(elements);
const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000;
const ACTIVITY_PERSIST_INTERVAL_MS = 15 * 1000;
let inactivityTimer = null;
let lastPersistedActivityAt = 0;

createVoiceInput({
  micBtn: elements.micBtn,
  micStatus: elements.micStatus,
  promptInput: elements.promptInput,
});

const newChatId = () => {
  if (window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const persist = () => saveState(state);
const hasActiveInterview = () => !!(state.chatId && state.contextSet && !state.interviewComplete);

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
  if (options.subtitle !== false) {
    setSubtitle(content);
  }
  if (options.speak !== false) {
    void tts.play(content);
  }
};

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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
  chatView.clearMessages();
  replaceState(state, createInitialState());
  state.context = createEmptyContext();
  chatView.setInterviewComplete(false);
  chatView.setIdleAnalysis();
  chatView.setFinalPlaceholder();
  clearState();
  contextModal.populate(state.context);
  contextModal.setMode('edit');
  chatView.setCoachBlurred(state.coachBlurred);
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
  contextModal.setMode('view');
  chatView.setInterviewComplete(state.interviewComplete);
  chatView.setCoachBlurred(state.coachBlurred);
  if (state.finalReview) {
    chatView.showFinalReview(state.finalReview);
  } else {
    chatView.setIdleAnalysis();
    chatView.setFinalPlaceholder();
  }
  contextModal.close();
  scheduleInactivityTimeout();
  return true;
};

const completeInterview = async (assistantMessage) => {
  clearInactivityTimer();
  state.interviewComplete = true;
  if (assistantMessage) {
    addAssistantMessage(assistantMessage);
    state.history.push({ role: 'assistant', content: assistantMessage });
  }
  chatView.setInterviewComplete(true);
  if (countUserTurns(state.history) === 0) {
    state.finalReview = null;
    chatView.showFinalReview(null);
    persist();
    return;
  }
  chatView.setFinalLoading();
  try {
    const closeResult = await closeInterview(state.chatId);
    state.finalReview = closeResult?.finalReview || null;
    if (state.finalReview) {
      chatView.showFinalReview(state.finalReview);
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

    addAssistantMessage(data.reply);
    state.history.push({ role: 'assistant', content: data.reply });
    state.chatId = data.chatId || state.chatId;
    if (data.backgroundDoc) {
      state.context.backgroundDoc = data.backgroundDoc;
      state.context.resumeText = data.resumeText || '';
      state.context.jobDescription = data.jobDescription || '';
      state.context.researchSummary = data.researchSummary || '';
      state.context.webSignals = data.webSignals || '';
    }
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
      await completeInterview();
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

  state.context = contextModal.read();
  state.contextSet = !!(state.context.company && state.context.role && state.context.resumeId);
  if (!state.chatId) {
    state.chatId = newChatId();
  }

  persist();
  contextModal.close();
  contextModal.setMode('view');

  if (!state.contextSet) {
    addAssistantMessage('Please set company, role, and pick a resume before chatting.');
    return;
  }

  markActivity();
  setThinking(true);
  try {
    const data = await startInterview({
      ...state.context,
      interviewComplete: state.interviewComplete,
      chatId: state.chatId,
    });

    if (data?.opener) {
      addAssistantMessage(data.opener);
      state.history.push({ role: 'assistant', content: data.opener });
      state.chatId = data.chatId || state.chatId;
      if (data.backgroundDoc) {
        state.context.backgroundDoc = data.backgroundDoc;
        state.context.resumeText = data.resumeText || '';
        state.context.jobDescription = data.jobDescription || '';
        state.context.researchSummary = data.researchSummary || '';
        state.context.webSignals = data.webSignals || '';
      }
      markActivity();
      scheduleInactivityTimeout();
    }
  } catch (error) {
    addAssistantMessage(`Error preparing interview: ${error.message}`);
  } finally {
    setThinking(false);
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
