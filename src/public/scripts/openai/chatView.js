export const createChatView = (elements) => {
  const {
    chatLog,
    analysisPanel,
    statusDot,
    promptInput,
    sendBtn,
    endBtn,
    form,
  } = elements;

  const setStatus = (label, active = false) => {
    statusDot.textContent = label;
    statusDot.classList.toggle('active', active);
  };

  const showAnalysisPlaceholder = (content) => {
    analysisPanel.innerHTML = `
      <p><strong>Your answer:</strong></p>
      <p>${content}</p>
      <p class="muted" style="margin-top:8px;">Planned analysis: structure (STAR), clarity, role alignment, and next-question suggestions.</p>
      <ul class="muted" style="margin-top:6px;">
        <li>Coming soon: automated strengths/risks per turn</li>
        <li>Context-aware follow-up prompts</li>
        <li>Score per response</li>
      </ul>
    `;
  };

  const addMessage = (role, content) => {
    const bubble = document.createElement('div');
    bubble.className = `bubble ${role === 'user' ? 'user' : 'ai'}`;
    bubble.textContent = content;
    chatLog.appendChild(bubble);
    chatLog.scrollTop = chatLog.scrollHeight;

    if (role === 'assistant') {
      bubble.title = 'Click to copy';
      bubble.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(content);
          setStatus('Copied!');
          setTimeout(() => setStatus('Ready'), 800);
        } catch {
          setStatus('Copy failed');
          setTimeout(() => setStatus('Ready'), 800);
        }
      });
      return;
    }

    bubble.title = 'Click to analyze';
    bubble.addEventListener('click', () => showAnalysisPlaceholder(content));
  };

  const clearMessages = () => {
    chatLog.innerHTML = '';
  };

  const setInterviewComplete = (complete) => {
    promptInput.disabled = complete;
    sendBtn.disabled = complete;
    endBtn.disabled = complete;
    form.classList.toggle('hidden', complete);
    if (complete) {
      setStatus('Complete');
    } else {
      setStatus('Ready');
      endBtn.disabled = false;
    }
  };

  return {
    addMessage,
    clearMessages,
    setStatus,
    setInterviewComplete,
  };
};
