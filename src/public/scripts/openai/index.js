import { startInterview, askInterview, closeInterview, getTurnReview } from './api.js';
import { createChatView } from './chatView.js';
import { createContextModal } from './contextModal.js';
import { createInitialState, createEmptyContext, replaceState } from './state.js';
import { saveState, loadState, clearState } from './storage.js';
import { createVoiceInput } from './voiceInput.js';
console.log(faceapi)

const elements = {
  chatLog: document.getElementById('chat-log'),
  form: document.getElementById('ai-form'),
  promptInput: document.getElementById('prompt'),
  statusDot: document.getElementById('ai-status'),
  setupBtn: document.getElementById('setup-btn'),
  contextBtn: document.getElementById('context-btn'),
  cameraBtn: document.getElementById('camera-btn'),
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

const addAssistantMessage = (content) => {
  chatView.addMessage('assistant', content);
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
};

const resetChat = () => {
  clearInactivityTimer();
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
    addAssistantMessage(message.content);
  });
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
  await completeInterview('Interview closed after 30 minutes of inactivity. Start a new session when you are ready to continue practicing.');
};

elements.form.addEventListener('submit', async (event) => {
  event.preventDefault();
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


elements.cameraBtn.addEventListener('click', () => {
  const run = async () => {
    const videoFeedEl = document.getElementById('video-feed')
    const cameraContainer = document.querySelector('.camera-container')

    if (videoFeedEl.srcObject) {
      // Remove each track from the stream and set the video's source to null
      console.log('closing camera')
      videoFeedEl.srcObject.getTracks().forEach(track => {
        track.stop()
      })
      videoFeedEl.srcObject = null
      cameraContainer.classList.remove('active')
    }
    else {
      // Set the video's stream to the user's camera
      console.log('opening camera')
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false
      })
      videoFeedEl.srcObject = stream
      cameraContainer.classList.add('active')

      // Loading models for pre-trained machine learning facial detection agent
      await Promise.all([
        faceapi.nets.ssdMobilenetv1.loadFromUri('../../models'),
        faceapi.nets.faceLandmark68Net.loadFromUri('../../models'),
        faceapi.nets.faceRecognitionNet.loadFromUri('../../models'),
        faceapi.nets.ageGenderNet.loadFromUri('../../models'),
        faceapi.nets.faceExpressionNet.loadFromUri('../../models')
      ])

      // Gather face data from frame of video per interval
      setInterval(async () => {
        let faceAIData = await faceapi.detectAllFaces(videoFeedEl).withFaceLandmarks().withFaceDescriptors().withAgeAndGender().withFaceExpressions()
        console.log(faceAIData)
      }, 500)
    }
  }
  run()
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
