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

  // the reason it would stop at whenever you pasued was that dictBuffer captures only a single event snapshot dropped all the earlier chunks
  let listening = false;
  let baseText = '';       // whatever was in the textarea when mic started
  let finalizedText = '';  // all finalized segments appeneded in this session

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
    // Add terminal punctuation if the session produced speech
    if (finalizedText.trim()) {
      const current = promptInput.value.trim();
      if (current && !/[.!?]$/.test(current)) {
        promptInput.value = `${current}.`;
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

    // Rebuild value: pre-existing text + everything finalized + current interim
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
