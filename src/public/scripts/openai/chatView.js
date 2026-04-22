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

const ringColorForGrade = (grade) => {
  if (grade === 'A') return '#2dd4bf';
  if (grade === 'B') return '#60a5fa';
  if (grade === 'C') return '#f0a202';
  if (grade === 'D') return '#fb923c';
  if (grade === 'F') return '#f65f5f';
  return '#94a3b8';
};

const formatDuration = (ms = 0) => {
  const totalSeconds = Math.max(0, Math.round(Number(ms || 0) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes <= 0) {
    return `${seconds}s`;
  }

  if (seconds === 0) {
    return `${minutes}m`;
  }

  return `${minutes}m ${seconds}s`;
};

export const createChatView = (elements) => {
  const {
    chatLog,
    analysisPanel,
    finalScorePanel,
    liveEngagementPanel,
    finalEngagementPanel,
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
  let screenEngagementMetric = null;

  const setStatus = (label, active = false) => {
    statusDot.textContent = label;
    statusDot.classList.toggle('active', active);
  };

  const setCoachBlurred = (blurred) => {
    analysisPanel.classList.toggle('is-blurred', blurred);
    liveEngagementPanel?.classList.toggle('is-blurred', blurred);
    chatLog.classList.toggle('coach-inline-blurred', blurred);
    if (analysisPrivacyBtn) {
      analysisPrivacyBtn.textContent = blurred ? 'Show coach' : 'Blur coach';
      analysisPrivacyBtn.classList.toggle('active', blurred);
    }
  };

  const renderEngagementMetric = (panel, metric, { compact = false } = {}) => {
    if (!panel) return;

    if (!metric) {
      panel.innerHTML = `
        <div class="coach-card coach-card-engagement is-empty">
          <p class="coach-card__eyebrow">Screen engagement</p>
          <p class="muted">Turn on camera tracking to see the on-screen gaze test here.</p>
        </div>
      `;
      return;
    }

    const headline =
      typeof metric.scorePct === 'number'
        ? `${metric.scorePct}% on-screen`
        : metric.calibrationActive
          ? 'Calibrating tracking'
          : metric.enabled
            ? metric.calibrated
              ? 'Waiting for answer window'
              : 'Calibrate for accuracy'
            : 'Tracking unavailable';

    const summary = metric.calibrationActive
      ? 'Click each calibration point while looking directly at it.'
      : !metric.enabled
        ? 'Camera + eye tracking need to be on before this test-only signal can run.'
        : metric.status === 'paused'
          ? 'The metric only scores answer windows, so it pauses while the interviewer is talking.'
          : metric.status === 'unknown'
            ? 'Tracking is live, but the current gaze signal is uncertain or stale.'
            : 'Broad on-screen gaze test. This does not require staring at one exact point.';

    panel.innerHTML = `
      <div class="coach-card coach-card-engagement ${metric.status === 'off' ? 'is-missed' : metric.status === 'on' ? 'is-focused' : ''}">
        <div class="coach-card__head">
          <div>
            <p class="coach-card__eyebrow">Screen engagement</p>
            <h4>${escapeHtml(headline)}</h4>
          </div>
          <span class="engagement-state-pill">${escapeHtml(metric.calibrationActive ? 'Calibrating' : metric.statusLabel || 'Idle')}</span>
        </div>
        <p class="coach-card__summary">${escapeHtml(summary)}</p>
        <div class="engagement-stat-grid ${compact ? 'is-compact' : ''}">
          <div class="engagement-stat">
            <span>On-screen</span>
            <strong>${escapeHtml(formatDuration(metric.onScreenMs))}</strong>
          </div>
          <div class="engagement-stat">
            <span>Off-screen</span>
            <strong>${escapeHtml(formatDuration(metric.offScreenMs))}</strong>
          </div>
          <div class="engagement-stat">
            <span>Unknown</span>
            <strong>${escapeHtml(formatDuration(metric.unknownMs))}</strong>
          </div>
        </div>
        <p class="engagement-note">Test only. This is not included in your saved interview grade yet.</p>
      </div>
    `;
  };

  const setScreenEngagementMetric = (metric) => {
    screenEngagementMetric = metric;
    renderEngagementMetric(liveEngagementPanel, screenEngagementMetric);
    renderEngagementMetric(finalEngagementPanel, screenEngagementMetric, { compact: true });
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
    const finalGrade = String(review.letterGrade || '').trim().toUpperCase() || 'C';
    const ringColor = ringColorForGrade(finalGrade);
    const gradeIsWide = finalGrade.length > 1;
    const bars = [
      { label: 'Role fit', score: review.categoryScores?.roleAlignment || 0 },
      { label: 'Relevance', score: review.categoryScores?.relevance || 0 },
      { label: 'Structured answers', score: review.categoryScores?.star || 0 },
      { label: 'Clarity', score: review.categoryScores?.clarity || 0 },
      { label: 'Confidence', score: review.categoryScores?.confidence || 0 },
    ];

    finalScorePanel.innerHTML = `
      <div class="final-score-shell">
        <div class="final-score-hero">
          <div class="final-score-grade">
            <div class="final-score-grade__label">GRADE</div>
            <div class="score-ring score-ring--open-center results-ring final-score-ring" style="--score:${(Number(review.overallScore) || 0) * 3.6}deg; --ring-color:${ringColor};">
              <div class="score-ring__fill"></div>
              <div class="score-ring__center">
                <div class="final-score-grade__letter ${gradeIsWide ? 'final-score-grade__letter--wide' : ''}">${escapeHtml(finalGrade)}</div>
              </div>
            </div>
          </div>
          <div class="final-score-meta">
            <p class="muted">${escapeHtml(review.overallSummary)}</p>
            <p class="final-score-note">Structured answers uses the STAR format: situation, task, action, result. Role fit and relevance count more than confidence in the final grade.</p>
          </div>
        </div>

        <div class="final-pill-row">
          <span class="final-pill">Strongest: ${escapeHtml(review.strongestArea)}</span>
          <span class="final-pill">Weakest: ${escapeHtml(review.weakestArea)}</span>
        </div>

        <div class="final-bars">
          ${bars
            .map(
              ({ label, score }) => `
                <div class="final-bar">
                  <div class="final-bar__label">
                    <span>${escapeHtml(label)}</span>
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
  setScreenEngagementMetric(null);

  return {
    addMessage,
    attachInlineAnalysis,
    clearDraftMessage,
    clearMessages,
    setDraftMessage,
    setCoachBlurred,
    setCoachTab,
    setStatus,
    setScreenEngagementMetric,
    setInterviewComplete,
    showTurnAnalysis,
    showFinalReview,
    setIdleAnalysis,
    setFinalLoading,
    setFinalPlaceholder,
  };
};
