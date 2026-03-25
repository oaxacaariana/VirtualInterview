export const createVoiceInput = ({ micBtn, micStatus, promptInput }) => {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    micBtn.disabled = true;
    micStatus.textContent = 'Voice unavailable';
    return;
  }

  const recognition = new SpeechRecognition();
  recognition.lang = 'en-US';
  recognition.interimResults = true;
  recognition.continuous = true;

  let listening = false;
  let dictBuffer = '';

  recognition.onstart = () => {
    listening = true;
    micBtn.classList.add('active');
    micBtn.classList.remove('outline');
    micStatus.textContent = 'Listening... tap to stop';
  };

  recognition.onend = () => {
    listening = false;
    micBtn.classList.remove('active');
    micBtn.classList.add('outline');
    if (dictBuffer) {
      const trimmed = promptInput.value.trim();
      if (trimmed && !/[.!?]$/.test(trimmed)) {
        promptInput.value = `${trimmed}.`;
      }
    }
    dictBuffer = '';
    delete promptInput.dataset.baseText;
    if (micStatus.textContent.startsWith('Listening')) {
      micStatus.textContent = '';
    }
  };

  recognition.onerror = (event) => {
    listening = false;
    micBtn.classList.remove('active');
    micBtn.classList.add('outline');
    micStatus.textContent = event.error === 'not-allowed' ? 'Mic blocked' : 'Mic error';
  };

  recognition.onresult = (event) => {
    let finalText = '';
    let interimText = '';

    for (let i = event.resultIndex; i < event.results.length; i += 1) {
      const transcript = event.results[i][0].transcript;
      if (event.results[i].isFinal) {
        finalText += transcript;
      } else {
        interimText += transcript;
      }
    }

    const existing = promptInput.dataset.baseText || promptInput.value;
    dictBuffer = (finalText || interimText).trim();
    promptInput.value = `${existing} ${dictBuffer}`.trim();
    promptInput.dataset.baseText = existing;
  };

  micBtn.addEventListener('click', () => {
    if (listening) {
      recognition.stop();
      return;
    }

    promptInput.dataset.baseText = promptInput.value;
    micStatus.textContent = 'Listening... tap to stop';
    recognition.start();
  });
};
