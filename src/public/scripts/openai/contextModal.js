/**
 * Interview context modal module.
 * Inputs: DOM element references plus resume/context state for setup form interactions.
 * Outputs: Modal open/close behavior and normalized context values read from the UI.
 */
const interviewConfig = window.__INTERVIEW_CONFIG__ || {};
const defaultModeId = interviewConfig.defaultModeId || 'operating';
const defaultPersonaId = interviewConfig.defaultPersonaId || 'skeptical-manager';
const defaultVoiceId = interviewConfig.voiceOptions?.[0]?.id || 'alloy';
const personaById = Object.fromEntries((interviewConfig.personas || []).map((persona) => [persona.id, persona]));

export const createContextModal = (elements) => {
  const {
    contextModal,
    closeModal,
    contextForm,
    contextSubmit,
    contextModalTitle,
    contextModalSubtitle,
    contextFeedback,
    ctxCompany,
    ctxRole,
    ctxResume,
    ctxWebSearch,
    ctxModeOperating,
    ctxModeCrazy,
    ctxPersona,
    ctxVoice,
    ctxCustomTone,
    ctxSeriousness,
    ctxStyle,
    ctxDifficulty,
    ctxComplexity,
    seriousnessVal,
    styleVal,
    difficultyVal,
    complexityVal,
    resumeCards,
    personaCards,
    operatingModeBlock,
    personaModeBlock,
    crazyModeBlock,
  } = elements;

  let panelMode = 'edit';
  let dismissible = true;
  let busy = false;

  const sliderFields = [ctxSeriousness, ctxStyle, ctxDifficulty, ctxComplexity];
  const editableFields = [
    ctxCompany,
    ctxRole,
    ctxWebSearch,
    ctxCustomTone,
    ...sliderFields,
  ];

  const formatSliderValue = (value, digits = 1) => Number(value).toFixed(digits);

  const getSelectedInterviewMode = () => (ctxModeCrazy?.checked ? 'crazy' : defaultModeId);

  const setSelectedInterviewMode = (mode) => {
    if (ctxModeOperating) {
      ctxModeOperating.checked = mode !== 'crazy';
    }
    if (ctxModeCrazy) {
      ctxModeCrazy.checked = mode === 'crazy';
    }
  };

  const setSliderProgress = (slider) => {
    if (!slider) return;
    const min = Number(slider.min || 0);
    const max = Number(slider.max || 1);
    const value = Number(slider.value || 0);
    const progress = max > min ? ((value - min) / (max - min)) * 100 : 0;
    slider.style.setProperty('--slider-progress', `${progress}%`);
  };

  const snapSliderValue = (slider) => {
    const step = 0.1;
    const min = Number(slider.min || 0);
    const max = Number(slider.max || 1);
    const value = Number(slider.value || 0);
    const snapped = Math.min(max, Math.max(min, Math.round(value / step) * step));
    slider.value = snapped.toFixed(1);
    setSliderProgress(slider);
  };

  const updateSliderLabels = () => {
    seriousnessVal.textContent = formatSliderValue(ctxSeriousness.value, ctxSeriousness.classList.contains('is-sliding') ? 2 : 1);
    styleVal.textContent = formatSliderValue(ctxStyle.value, ctxStyle.classList.contains('is-sliding') ? 2 : 1);
    difficultyVal.textContent = formatSliderValue(ctxDifficulty.value, ctxDifficulty.classList.contains('is-sliding') ? 2 : 1);
    complexityVal.textContent = formatSliderValue(ctxComplexity.value, ctxComplexity.classList.contains('is-sliding') ? 2 : 1);
  };

  const lockSlider = (slider) => {
    snapSliderValue(slider);
    slider.blur();
    slider.classList.remove('is-sliding');
    updateSliderLabels();
  };

  const syncSelectedResume = (resumeId) => {
    ctxResume.value = resumeId || '';
    resumeCards.forEach((card) => {
      card.classList.toggle('selected', card.dataset.resumeId === resumeId);
    });
  };

  const syncSelectedPersona = (personaId) => {
    const nextPersonaId = personaId || defaultPersonaId;
    ctxPersona.value = nextPersonaId;
    personaCards.forEach((card) => {
      card.classList.toggle('selected', card.dataset.personaId === nextPersonaId);
    });
  };

  const syncSelectedVoice = (voiceId) => {
    if (!ctxVoice) return;
    ctxVoice.value = voiceId || defaultVoiceId;
  };

  const syncPersonaVoice = () => {
    const persona = personaById[ctxPersona.value || defaultPersonaId];
    if (!persona || !ctxVoice) return;
    syncSelectedVoice(persona.voice || defaultVoiceId);
  };

  const setFeedback = (message = '', tone = 'error') => {
    if (!contextFeedback) {
      return;
    }

    contextFeedback.textContent = message;
    contextFeedback.classList.toggle('hidden', !message);
    contextFeedback.dataset.tone = tone;
  };

  const syncModeBlocks = () => {
    const crazy = getSelectedInterviewMode() === 'crazy';
    operatingModeBlock?.classList.toggle('hidden', crazy);
    personaModeBlock?.classList.toggle('hidden', crazy);
    crazyModeBlock?.classList.toggle('hidden', !crazy);
  };

  const syncModalUi = () => {
    const canClose = dismissible && !busy;
    closeModal.classList.toggle('hidden', !dismissible);
    closeModal.disabled = !canClose;
    closeModal.setAttribute('aria-hidden', String(!dismissible));
    contextSubmit.disabled = busy;
    contextSubmit.textContent = busy ? 'Preparing interview...' : 'Create new chat';
  };

  const applyFieldState = () => {
    const isView = panelMode === 'view';
    const isCrazy = getSelectedInterviewMode() === 'crazy';

    editableFields.forEach((field) => {
      field.disabled = isView || busy;
    });

    if (ctxModeOperating) ctxModeOperating.disabled = isView || busy;
    if (ctxModeCrazy) ctxModeCrazy.disabled = isView || busy;
    if (ctxPersona) ctxPersona.disabled = isView || busy;
    if (ctxVoice) ctxVoice.disabled = !isCrazy || isView || busy;

    ctxCustomTone.disabled = !isCrazy || isView || busy;
    sliderFields.forEach((slider) => {
      slider.disabled = !isCrazy || isView || busy;
    });

    resumeCards.forEach((card) => {
      card.classList.toggle('is-readonly', isView || busy);
    });

    personaCards.forEach((card) => {
      card.classList.toggle('is-readonly', isView || busy);
    });

    syncModeBlocks();
  };

  const open = () => {
    syncModalUi();
    contextModal.classList.remove('hidden');
  };

  const close = (options = {}) => {
    if ((!dismissible || busy) && !options.force) {
      return;
    }
    contextModal.classList.add('hidden');
  };

  const setMode = (nextMode) => {
    panelMode = nextMode;
    const isView = panelMode === 'view';
    contextModal.dataset.mode = panelMode;
    contextModalTitle.textContent = isView ? 'Active interview setup' : 'Create new chat';
    contextModalSubtitle.textContent = isView
      ? 'Review the current mode, personality, and setup without interrupting the interview.'
      : 'Choose the mode, personality, resume, and launch.';
    contextSubmit.classList.toggle('hidden', isView);
    applyFieldState();
    syncModalUi();
  };

  const setDismissible = (nextDismissible) => {
    dismissible = !!nextDismissible;
    syncModalUi();
  };

  const setBusy = (nextBusy) => {
    busy = !!nextBusy;
    applyFieldState();
    syncModalUi();
  };

  const populate = (context) => {
    ctxCompany.value = context.company || '';
    ctxRole.value = context.role || '';
    ctxWebSearch.checked = context.webSearchEnabled !== false;
    setSelectedInterviewMode(context.mode || (context.silly ? 'crazy' : defaultModeId));
    syncSelectedPersona(context.personaId || defaultPersonaId);
    syncSelectedVoice(context.ttsVoice || personaById[context.personaId || defaultPersonaId]?.voice || defaultVoiceId);
    ctxCustomTone.value = context.customTone || '';
    ctxSeriousness.value = context.seriousness ?? 0.5;
    ctxStyle.value = context.style ?? 0.5;
    ctxDifficulty.value = context.difficulty ?? 0.5;
    ctxComplexity.value = context.complexity ?? 0.5;
    sliderFields.forEach((slider) => setSliderProgress(slider));
    updateSliderLabels();
    syncModeBlocks();
    syncSelectedResume(context.resumeId || '');
  };

  const read = () => ({
    company: ctxCompany.value.trim(),
    role: ctxRole.value.trim(),
    resumeId: ctxResume.value,
    mode: getSelectedInterviewMode(),
    personaId: ctxPersona.value || defaultPersonaId,
    ttsVoice: ctxVoice?.value || defaultVoiceId,
    backgroundDoc: '',
    webSearchEnabled: !!ctxWebSearch.checked,
    customTone: (ctxCustomTone.value || '').trim().slice(0, 200),
    seriousness: parseFloat(ctxSeriousness.value),
    style: parseFloat(ctxStyle.value),
    difficulty: parseFloat(ctxDifficulty.value),
    complexity: parseFloat(ctxComplexity.value),
  });

  sliderFields.forEach((slider) => {
    setSliderProgress(slider);
    slider.addEventListener('input', () => {
      setSliderProgress(slider);
      updateSliderLabels();
    });
    slider.addEventListener('pointerdown', (event) => {
      slider.classList.add('is-sliding');
      slider.setPointerCapture?.(event.pointerId);
      updateSliderLabels();
    });
    slider.addEventListener('pointerup', (event) => {
      slider.releasePointerCapture?.(event.pointerId);
      lockSlider(slider);
    });
    slider.addEventListener('pointercancel', () => lockSlider(slider));
    slider.addEventListener('blur', () => lockSlider(slider));
    slider.addEventListener('change', () => lockSlider(slider));
    slider.addEventListener('keyup', (event) => {
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        setSliderProgress(slider);
        updateSliderLabels();
      }
      if (event.key === 'Enter' || event.key === 'Escape') {
        lockSlider(slider);
      }
    });
  });

  [ctxModeOperating, ctxModeCrazy].forEach((input) => {
    input?.addEventListener('change', () => {
      applyFieldState();
    });
  });

  closeModal.addEventListener('click', close);

  resumeCards.forEach((card) => {
    card.addEventListener('click', () => {
      if (panelMode === 'view' || busy) {
        return;
      }
      syncSelectedResume(card.dataset.resumeId);
    });
  });

  personaCards.forEach((card) => {
    card.addEventListener('click', () => {
      if (panelMode === 'view' || busy) {
        return;
      }
      syncSelectedPersona(card.dataset.personaId);
      syncPersonaVoice();
    });
  });

  updateSliderLabels();
  setSelectedInterviewMode(defaultModeId);
  syncSelectedPersona(defaultPersonaId);
  syncSelectedVoice(personaById[defaultPersonaId]?.voice || defaultVoiceId);
  setMode('edit');
  syncModalUi();
  syncModeBlocks();

  return {
    open,
    close,
    setMode,
    setDismissible,
    setBusy,
    setFeedback,
    populate,
    read,
    contextForm,
  };
};
