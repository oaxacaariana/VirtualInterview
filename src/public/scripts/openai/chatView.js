/**
 * Interview chat view module.
 * Inputs: DOM element references plus interview messages, review payloads, and UI state changes.
 * Outputs: DOM updates for chat bubbles, coach analysis panels, and final review rendering.
 */
const escapeHtml = (value) =>
  String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

const verdictLabel = (verdict) => {
  if (verdict === 'strong') return 'Strong';
  if (verdict === 'weak') return 'Needs work';
  return 'Mixed';
};

const verdictClass = (verdict) => {
  if (verdict === 'strong') return 'is-strong';
  if (verdict === 'weak') return 'is-weak';
  return 'is-mixed';
};

export const createChatView = (elements) => {
  const {
    chatLog,
    analysisPanel,
    finalScorePanel,
    statusDot,
    promptInput,
    sendBtn,
    endBtn,
    form,
    analysisPrivacyBtn,
    toggleChatBtn,
    toggleCoachBtn,
    coachTabLive,
    coachTabFinal,
    coachTabPanelLive,
    coachTabPanelFinal,
    completeBanner,
  } = elements;
  let draftBubble = null;
  let draftTextNode = null;
  let draftMetaNode = null;

  const setStatus = (label, active = false) => {
    statusDot.textContent = label;
    statusDot.classList.toggle('active', active);
  };

  const setCoachBlurred = (blurred) => {
    analysisPanel.classList.toggle('is-blurred', blurred);
    chatLog.classList.toggle('coach-inline-blurred', blurred);
    if (analysisPrivacyBtn) {
      analysisPrivacyBtn.textContent = blurred ? 'Show coach' : 'Blur coach';
      analysisPrivacyBtn.classList.toggle('active', blurred);
    }
  };

  const setCoachTab = (tab) => {
    const showFinal = tab === 'final';
    coachTabLive?.classList.toggle('is-active', !showFinal);
    coachTabLive?.setAttribute('aria-selected', String(!showFinal));
    coachTabFinal?.classList.toggle('is-active', showFinal);
    coachTabFinal?.setAttribute('aria-selected', String(showFinal));
    coachTabPanelLive?.classList.toggle('is-active', !showFinal);
    coachTabPanelFinal?.classList.toggle('is-active', showFinal);
  };

  const setIdleAnalysis = () => {
    analysisPanel.innerHTML = `
      <div class="coach-empty">
        <p class="coach-empty__title">Response analysis will show up here.</p>
        <p class="muted">Click one of your answers after it lands to inspect the positives, negatives, and overall read.</p>
      </div>
    `;
  };

  const setFinalPlaceholder = () => {
    finalScorePanel.innerHTML = `
      <div class="final-score-shell is-empty">
        <p class="coach-empty__title">Final score locked at the end.</p>
        <p class="muted">Once the interview is complete, you'll see the score, strengths, weak spots, and category breakdown here.</p>
      </div>
    `;
  };

  const setFinalLoading = () => {
    finalScorePanel.innerHTML = `
      <div class="final-score-shell is-empty final-score-shell-loading">
        <div class="final-score-loader" aria-hidden="true"></div>
        <p class="coach-empty__title">Building your final interview score...</p>
        <p class="muted">We are reviewing the full conversation and assembling the final breakdown now.</p>
      </div>
    `;
  };

  const showAnalysisPlaceholder = (content) => {
    analysisPanel.innerHTML = `
      <div class="coach-card">
        <p class="coach-card__eyebrow">Selected answer</p>
        <p class="coach-card__answer">${escapeHtml(content)}</p>
        <p class="muted">Analysis is not available for this response yet.</p>
      </div>
    `;
  };

  const showTurnAnalysis = ({ analysis, answer }) => {
    if (!analysis) {
      showAnalysisPlaceholder(answer);
      return;
    }

    const positives = (analysis.positives || [])
      .map((item) => `<li>${escapeHtml(item)}</li>`)
      .join('');
    const negatives = (analysis.negatives || [])
      .map((item) => `<li>${escapeHtml(item)}</li>`)
      .join('');

    analysisPanel.innerHTML = `
      <div class="coach-card">
        <div class="coach-card__head">
          <div>
            <p class="coach-card__eyebrow">Response read</p>
            <h4>Turn ${escapeHtml(analysis.turnNumber)}</h4>
          </div>
          <span class="verdict-pill ${verdictClass(analysis.verdict)}">${escapeHtml(verdictLabel(analysis.verdict))}</span>
        </div>
        <p class="coach-card__answer">${escapeHtml(answer)}</p>
        <p class="coach-card__summary">${escapeHtml(analysis.summary)}</p>
        <div class="coach-grid">
          <div class="coach-list coach-list-positive">
            <p>Positives</p>
            <ul>${positives}</ul>
          </div>
          <div class="coach-list coach-list-negative">
            <p>Negatives</p>
            <ul>${negatives}</ul>
          </div>
        </div>
      </div>
    `;
  };

  const showFinalReview = (review) => {
    if (!review) {
      setFinalPlaceholder();
      return;
    }

    const strengths = (review.strengths || [])
      .map((item) => `<li>${escapeHtml(item)}</li>`)
      .join('');
    const improvements = (review.improvements || [])
      .map((item) => `<li>${escapeHtml(item)}</li>`)
      .join('');
    const bars = [
      ['Relevance', review.categoryScores?.relevance || 0],
      ['STAR', review.categoryScores?.star || 0],
      ['Role fit', review.categoryScores?.roleAlignment || 0],
      ['Clarity', review.categoryScores?.clarity || 0],
      ['Confidence', review.categoryScores?.confidence || 0],
    ];

    finalScorePanel.innerHTML = `
      <div class="final-score-shell">
        <div class="final-score-hero">
          <div class="score-ring results-ring final-score-ring" style="--score:${(Number(review.overallScore) || 0) * 3.6}deg; --ring-color:${Number(review.overallScore) >= 80 ? '#2dd4bf' : Number(review.overallScore) >= 65 ? '#60a5fa' : Number(review.overallScore) >= 50 ? '#f0a202' : '#f65f5f'};">
            <div class="score-ring__fill"></div>
            <div class="score-ring__center">${escapeHtml(review.overallScore)}</div>
          </div>
          <div class="final-score-meta">
            <p class="coach-card__eyebrow">Final grade</p>
            <h4>${escapeHtml(review.letterGrade)}</h4>
            <p class="muted">${escapeHtml(review.overallSummary)}</p>
          </div>
        </div>

        <div class="final-pill-row">
          <span class="final-pill">Strongest: ${escapeHtml(review.strongestArea)}</span>
          <span class="final-pill">Weakest: ${escapeHtml(review.weakestArea)}</span>
          <span class="final-pill">Turns reviewed: ${escapeHtml(review.reviewedTurns)}</span>
        </div>

        <div class="final-bars">
          ${bars
            .map(
              ([label, score]) => `
                <div class="final-bar">
                  <div class="final-bar__label">
                    <span>${escapeHtml(label)}</span>
                    <span>${escapeHtml(score)}/10</span>
                  </div>
                  <div class="final-bar__track">
                    <div class="final-bar__fill" style="width:${Math.max(0, Math.min(100, Number(score) * 10))}%"></div>
                  </div>
                </div>
              `
            )
            .join('')}
        </div>

        <div class="coach-grid">
          <div class="coach-list coach-list-positive">
            <p>Strengths</p>
            <ul>${strengths}</ul>
          </div>
          <div class="coach-list coach-list-negative">
            <p>Fix next</p>
            <ul>${improvements}</ul>
          </div>
        </div>

        <div class="coach-card coach-card-patterns">
          <p class="coach-card__eyebrow">Interview pattern</p>
          <p>${escapeHtml(review.patterns)}</p>
        </div>

        <div class="coach-card final-score-next">
          <p class="coach-card__eyebrow">Next step</p>
          <p>Interview complete. Review the saved transcript any time from your history.</p>
          <div class="final-score-actions">
            <a href="/openai/logs" class="btn-outline">Open chat history</a>
          </div>
        </div>
      </div>
    `;
  };

  const addMessage = (role, content, options = {}) => {
    const bubble = document.createElement('div');
    bubble.className = `bubble ${role === 'user' ? 'user' : 'ai'}`;

    const bubbleText = document.createElement('div');
    bubbleText.className = 'bubble__text';
    bubbleText.textContent = content;
    bubble.appendChild(bubbleText);

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
      return bubble;
    }

    bubble.title = 'Click to inspect response analysis';
    bubble.addEventListener('click', () => {
      if (typeof options.onSelect === 'function') {
        options.onSelect();
        return;
      }
      showAnalysisPlaceholder(content);
    });

    return bubble;
  };

  const ensureDraftBubble = () => {
    if (draftBubble) {
      return draftBubble;
    }

    draftBubble = document.createElement('div');
    draftBubble.className = 'bubble user bubble-draft';
    draftBubble.title = 'Live speech draft';

    draftTextNode = document.createElement('div');
    draftTextNode.className = 'bubble__text';
    draftBubble.appendChild(draftTextNode);

    draftMetaNode = document.createElement('div');
    draftMetaNode.className = 'bubble-draft__meta';
    draftBubble.appendChild(draftMetaNode);

    chatLog.appendChild(draftBubble);
    return draftBubble;
  };

  const setDraftMessage = ({ text = '', status = '' } = {}) => {
    const bubble = ensureDraftBubble();
    draftTextNode.textContent = text || 'Listening...';
    draftMetaNode.textContent = status || 'Live transcription';
    chatLog.scrollTop = chatLog.scrollHeight;
    return bubble;
  };

  const clearDraftMessage = () => {
    draftBubble?.remove();
    draftBubble = null;
    draftTextNode = null;
    draftMetaNode = null;
  };

  const attachInlineAnalysis = (bubble, analysis) => {
    if (!bubble || !analysis) return;

    const existing = bubble.querySelector('.bubble-analysis');
    if (existing) {
      existing.remove();
    }

    const analysisNode = document.createElement('div');
    analysisNode.className = `bubble-analysis ${verdictClass(analysis.verdict)}`;
    analysisNode.innerHTML = `
      <span class="bubble-analysis__pill">${escapeHtml(verdictLabel(analysis.verdict))}</span>
      <span class="bubble-analysis__meta">${escapeHtml(analysis.positives?.[0] || 'Analysis ready')}</span>
    `;
    bubble.appendChild(analysisNode);
  };

  const clearMessages = () => {
    clearDraftMessage();
    chatLog.innerHTML = '';
  };

  const setInterviewComplete = (complete) => {
    promptInput.disabled = complete;
    sendBtn.disabled = complete;
    endBtn.disabled = complete;
    if (toggleChatBtn) {
      toggleChatBtn.disabled = complete;
      toggleChatBtn.classList.toggle('is-disabled', complete);
      toggleChatBtn.classList.remove('is-active');
    }
    if (toggleCoachBtn) {
      toggleCoachBtn.classList.toggle('is-finished', complete);
    }
    form.classList.toggle('hidden', complete);
    completeBanner?.classList.toggle('hidden', !complete);
    if (complete) {
      setCoachTab('final');
      setStatus('Interview complete');
    } else {
      completeBanner?.classList.add('hidden');
      setCoachTab('live');
      setStatus('Ready');
      endBtn.disabled = false;
    }
  };

  coachTabLive?.addEventListener('click', () => setCoachTab('live'));
  coachTabFinal?.addEventListener('click', () => setCoachTab('final'));

  setIdleAnalysis();
  setFinalPlaceholder();
  setCoachTab('live');

  return {
    addMessage,
    attachInlineAnalysis,
    clearDraftMessage,
    clearMessages,
    setDraftMessage,
    setCoachBlurred,
    setCoachTab,
    setStatus,
    setInterviewComplete,
    showTurnAnalysis,
    showFinalReview,
    setIdleAnalysis,
    setFinalLoading,
    setFinalPlaceholder,
  };
};
