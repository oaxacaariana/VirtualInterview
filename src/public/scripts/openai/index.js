import { startInterview, askInterview, closeInterview } from './api.js';
import { createChatView } from './chatView.js';
import { createContextModal } from './contextModal.js';
import { createInitialState, createEmptyContext, replaceState } from './state.js';
import { saveState, loadState, clearState } from './storage.js';
import { createVoiceInput } from './voiceInput.js';

const elements = {
  chatLog: document.getElementById('chat-log'),
  form: document.getElementById('ai-form'),
  promptInput: document.getElementById('prompt'),
  statusDot: document.getElementById('ai-status'),
  contextBtn: document.getElementById('context-btn'),
  endBtn: document.getElementById('end-btn'),
  sendBtn: document.getElementById('send-btn'),
  micBtn: document.getElementById('mic-btn'),
  micStatus: document.getElementById('mic-status'),
  contextModal: document.getElementById('context-modal'),
  closeModal: document.getElementById('close-modal'),
  contextForm: document.getElementById('context-form'),
  ctxCompany: document.getElementById('ctx-company'),
  ctxRole: document.getElementById('ctx-role'),
  ctxResume: document.getElementById('ctx-resume'),
  ctxSilly: document.getElementById('ctx-silly'),
  ctxCustomTone: document.getElementById('ctx-custom-tone'),
  ctxSeriousness: document.getElementById('ctx-seriousness'),
  ctxStyle: document.getElementById('ctx-style'),
  ctxDifficulty: document.getElementById('ctx-difficulty'),
  seriousnessVal: document.getElementById('seriousness-val'),
  styleVal: document.getElementById('style-val'),
  difficultyVal: document.getElementById('difficulty-val'),
  resumeCards: [...document.querySelectorAll('.resume-card')],
  analysisPanel: document.getElementById('analysis-panel'),
};

const state = createInitialState();
const chatView = createChatView(elements);
const contextModal = createContextModal(elements);

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

const setThinking = (thinking) => {
  chatView.setStatus(thinking ? 'Thinking...' : 'Ready', thinking);
};

const resetChat = () => {
  chatView.clearMessages();
  replaceState(state, createInitialState());
  state.context = createEmptyContext();
  chatView.setInterviewComplete(false);
  clearState();
  contextModal.populate(state.context);
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
  state.history.forEach((message) => {
    chatView.addMessage(message.role, message.content);
  });
  contextModal.populate(state.context);
  chatView.setInterviewComplete(state.interviewComplete);
  contextModal.close();
  return true;
};

const completeInterview = async (assistantMessage) => {
  state.interviewComplete = true;
  if (assistantMessage) {
    chatView.addMessage('assistant', assistantMessage);
    state.history.push({ role: 'assistant', content: assistantMessage });
  }
  chatView.setInterviewComplete(true);
  persist();
  await closeInterview(state.chatId);
};

elements.form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const prompt = (elements.promptInput.value || '').trim();
  if (!prompt) {
    return;
  }

  if (!state.contextSet || !state.context.company || !state.context.role || !state.context.resumeId) {
    chatView.addMessage('assistant', 'Please set company, role, and pick a resume before chatting.');
    return;
  }

  if (state.interviewComplete) {
    chatView.addMessage('assistant', 'Interview is marked complete. Start a new session to continue.');
    return;
  }

  chatView.addMessage('user', prompt);
  state.history.push({ role: 'user', content: prompt });
  persist();
  elements.promptInput.value = '';
  setThinking(true);

  try {
    const data = await askInterview({
      prompt,
      transcript: state.history,
      interviewComplete: state.interviewComplete,
      chatId: state.chatId,
      ...state.context,
    });

    chatView.addMessage('assistant', data.reply);
    state.history.push({ role: 'assistant', content: data.reply });
    state.chatId = data.chatId || state.chatId;

    if (data.interviewComplete) {
      await completeInterview();
    } else {
      persist();
    }
  } catch (error) {
    chatView.addMessage('assistant', `Something went wrong: ${error.message}`);
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

  if (!state.contextSet) {
    chatView.addMessage('assistant', 'Please set company, role, and pick a resume before chatting.');
    return;
  }

  setThinking(true);
  try {
    const data = await startInterview({
      ...state.context,
      interviewComplete: state.interviewComplete,
      chatId: state.chatId,
    });

    if (data?.opener) {
      chatView.addMessage('assistant', data.opener);
      state.history.push({ role: 'assistant', content: data.opener });
      state.chatId = data.chatId || state.chatId;
      persist();
    }
  } catch (error) {
    chatView.addMessage('assistant', `Error preparing interview: ${error.message}`);
  } finally {
    setThinking(false);
  }
});

elements.contextBtn.addEventListener('click', () => {
  resetChat();
  contextModal.open();
});

elements.endBtn.addEventListener('click', async () => {
  await completeInterview('Interview marked complete. Thanks for practicing!');
});

if (!hydrate()) {
  resetChat();
  contextModal.open();
}
