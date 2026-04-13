/**
 * Voice input helper module.
 * Inputs: DOM controls for microphone state and the prompt input field.
 * Outputs: Browser speech-recognition wiring that appends dictated text into the prompt box.
 */
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
  let baseText = '';
  let finalizedText = '';

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
    if (finalizedText.trim()) {
      const trimmed = promptInput.value.trim();
      if (trimmed && !/[.!?]$/.test(trimmed)) {
        promptInput.value = `${trimmed}.`;
      }
    }
    finalizedText = '';
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
    let interimText = '';

    for (let i = event.resultIndex; i < event.results.length; i += 1) {
      const transcript = event.results[i][0].transcript;
      if (event.results[i].isFinal) {
        finalizedText += `${transcript} `;
      } else {
        interimText += transcript;
      }
    }

    promptInput.value = `${baseText} ${finalizedText}${interimText}`.trim();
  };

  micBtn.addEventListener('click', () => {
    if (listening) {
      recognition.stop();
      return;
    }

    baseText = promptInput.value;
    finalizedText = '';
    recognition.start();
  });
};
