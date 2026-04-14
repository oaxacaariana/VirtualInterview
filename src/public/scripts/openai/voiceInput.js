/**
 * Voice input helper module.
 * Inputs: DOM controls for microphone state and the prompt input field.
 * Outputs: Push-to-talk recording that uploads audio to OpenAI transcription and appends text into the prompt box.
 */
export const createVoiceInput = ({
  micBtn,
  micStatus,
  promptInput,
  onDraftUpdate,
  onDraftClear,
}) => {
  if (!navigator.mediaDevices?.getUserMedia || typeof window.MediaRecorder === 'undefined') {
    micBtn.disabled = true;
    micStatus.textContent = 'Voice unavailable';
    return;
  }

  const preferredMimeTypes = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/mp4',
  ];
  const mimeType =
    preferredMimeTypes.find((candidate) => window.MediaRecorder.isTypeSupported(candidate)) || '';

  const getExtension = () => {
    if (mimeType.includes('ogg')) return 'ogg';
    if (mimeType.includes('mp4')) return 'mp4';
    return 'webm';
  };

  let stream = null;
  let recorder = null;
  let chunks = [];
  let recording = false;
  let transcribing = false;
  let baseText = '';
  let previewFrame = null;
  let liveTranscript = '';
  let liveRequestInFlight = false;
  let liveRequestQueued = false;
  let liveRevision = 0;
  let lastAppliedLiveRevision = 0;
  let liveTranscriptionPromise = Promise.resolve();
  const defaultLabel = micBtn.textContent;
  const defaultPlaceholder = promptInput.placeholder;

  const setButtonLabel = (label) => {
    micBtn.textContent = label;
  };

  const stopPreviewPulse = () => {
    if (previewFrame) {
      window.clearInterval(previewFrame);
      previewFrame = null;
    }
  };

  const emitDraftUpdate = ({ text = '', status = '' } = {}) => {
    onDraftUpdate?.({ text, status });
  };

  const clearDraft = () => {
    onDraftClear?.();
  };

  const renderPromptPreview = (label, step = 0, transcript = '') => {
    const cleanTranscript = String(transcript || '').trim();
    if (cleanTranscript) {
      promptInput.value = `${baseText} ${cleanTranscript}`.trim();
      return;
    }

    const dots = '.'.repeat((step % 3) + 1);
    const previewText = `[Speech preview] ${label}${dots}`;
    promptInput.value = baseText ? `${baseText}\n\n${previewText}` : previewText;
  };

  const restorePrompt = () => {
    stopPreviewPulse();
    promptInput.value = baseText;
    promptInput.placeholder = defaultPlaceholder;
    liveTranscript = '';
    clearDraft();
  };

  const startPromptPreview = (label, status, transcript = '') => {
    let step = 0;
    promptInput.placeholder = defaultPlaceholder;
    renderPromptPreview(label, step, transcript);
    emitDraftUpdate({
      text: transcript || 'Listening...',
      status,
    });
    stopPreviewPulse();
    previewFrame = window.setInterval(() => {
      step += 1;
      renderPromptPreview(label, step, liveTranscript || transcript);
      emitDraftUpdate({
        text: liveTranscript || 'Listening...',
        status: `${status}${'.'.repeat((step % 3) + 1)}`,
      });
    }, 420);
  };

  const setIdle = (message = '') => {
    recording = false;
    micBtn.classList.remove('active');
    micBtn.classList.add('outline');
    micBtn.disabled = false;
    setButtonLabel(defaultLabel);
    micStatus.textContent = message;
    stopPreviewPulse();
  };

  const cleanupStream = () => {
    stream?.getTracks().forEach((track) => track.stop());
    stream = null;
  };

  const appendTranscript = (text) => {
    const transcript = String(text || '').trim();
    if (!transcript) {
      restorePrompt();
      return;
    }

    liveTranscript = transcript;
    promptInput.value = `${baseText} ${transcript}`.trim();

    const trimmed = promptInput.value.trim();
    if (trimmed && !/[.!?]$/.test(trimmed)) {
      promptInput.value = `${trimmed}.`;
    }
    clearDraft();
  };

  const transcribeBlob = async (blob) => {
    const formData = new FormData();
    formData.append('audio', blob, `interview-note.${getExtension()}`);

    const response = await fetch('/openai/transcribe', {
      method: 'POST',
      body: formData,
      headers: {
        Accept: 'application/json',
      },
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.error || 'Transcription failed.');
    }

    return payload;
  };

  const queueLiveTranscription = () => {
    if (!recording || !chunks.length) {
      return liveTranscriptionPromise;
    }

    if (liveRequestInFlight) {
      liveRequestQueued = true;
      return liveTranscriptionPromise;
    }

    liveRequestInFlight = true;
    const revision = ++liveRevision;
    const snapshot = chunks.slice();

    liveTranscriptionPromise = (async () => {
      try {
        const blob = new Blob(snapshot, { type: mimeType || 'audio/webm' });
        const payload = await transcribeBlob(blob);
        const text = String(payload.text || '').trim();

        if (text && revision >= lastAppliedLiveRevision) {
          lastAppliedLiveRevision = revision;
          liveTranscript = text;
          renderPromptPreview('Listening', 0, liveTranscript);
          emitDraftUpdate({
            text: liveTranscript,
            status: 'Live transcript',
          });
        }
      } catch (error) {
        console.warn('Live transcription update failed:', error);
      } finally {
        liveRequestInFlight = false;
        if (recording && liveRequestQueued) {
          liveRequestQueued = false;
          queueLiveTranscription();
        }
      }
    })();

    return liveTranscriptionPromise;
  };

  const transcribeRecording = async () => {
    if (!chunks.length) {
      restorePrompt();
      setIdle('');
      return;
    }

    transcribing = true;
    micBtn.disabled = true;
    setButtonLabel('Working...');
    micStatus.textContent = 'Transcribing...';
    liveRequestQueued = false;
    await liveTranscriptionPromise.catch(() => {});
    startPromptPreview('Transcribing your answer', 'Finalizing transcript', liveTranscript);

    try {
      const blob = new Blob(chunks, { type: mimeType || 'audio/webm' });
      const payload = await transcribeBlob(blob);
      appendTranscript(payload.text);
      setIdle('');
    } catch (error) {
      console.warn('Voice transcription failed:', error);
      restorePrompt();
      setIdle(error.message || 'Mic error');
    } finally {
      transcribing = false;
      chunks = [];
      micBtn.disabled = false;
    }
  };

  const stopRecording = () => {
    if (!recorder || recorder.state === 'inactive') {
      return;
    }

    recording = false;
    stopPreviewPulse();
    renderPromptPreview('Finalizing recording', 0, liveTranscript);
    emitDraftUpdate({
      text: liveTranscript || 'Finishing recording...',
      status: 'Finalizing recording',
    });
    recorder.stop();
    micStatus.textContent = 'Finishing recording...';
  };

  const startRecording = async () => {
    if (transcribing) {
      return;
    }

    try {
      baseText = promptInput.value.trim();
      chunks = [];
      liveTranscript = '';
      liveRequestInFlight = false;
      liveRequestQueued = false;
      liveRevision = 0;
      lastAppliedLiveRevision = 0;
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);

      recorder.addEventListener('dataavailable', (event) => {
        if (event.data && event.data.size > 0) {
          chunks.push(event.data);
          if (recording) {
            void queueLiveTranscription();
          }
        }
      });

      recorder.addEventListener('stop', async () => {
        cleanupStream();
        await transcribeRecording();
      });

      recorder.start(1400);
      recording = true;
      micBtn.classList.add('active');
      micBtn.classList.remove('outline');
      setButtonLabel('Stop');
      micStatus.textContent = 'Recording... tap to stop';
      startPromptPreview('Listening', 'Listening live');
    } catch (error) {
      console.warn('Voice recording failed:', error);
      cleanupStream();
      restorePrompt();
      setIdle(error?.name === 'NotAllowedError' ? 'Mic blocked' : 'Mic error');
    }
  };

  micBtn.addEventListener('click', () => {
    if (recording) {
      stopRecording();
      return;
    }
    void startRecording();
  });
};
