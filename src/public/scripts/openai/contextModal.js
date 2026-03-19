export const createContextModal = (elements) => {
  const {
    contextModal,
    closeModal,
    contextForm,
    contextSubmit,
    contextModalTitle,
    contextModalSubtitle,
    ctxCompany,
    ctxRole,
    ctxResume,
    ctxWebSearch,
    ctxSilly,
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
  } = elements;

  let mode = 'edit';

  const formatSliderValue = (value, digits = 1) => Number(value).toFixed(digits);

  const setSliderProgress = (slider) => {
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

  const toggleCustomTone = () => {
    const enabled = ctxSilly.checked;
    const block = document.getElementById('custom-tone-block');
    if (block) {
      block.classList.toggle('hidden', !enabled);
    }
    ctxCustomTone.disabled = !enabled;
    if (!enabled) {
      ctxCustomTone.value = '';
    }
  };

  const syncSelectedResume = (resumeId) => {
    ctxResume.value = resumeId || '';
    resumeCards.forEach((card) => {
      card.classList.toggle('selected', card.dataset.resumeId === resumeId);
    });
  };

  const open = () => contextModal.classList.remove('hidden');
  const close = () => contextModal.classList.add('hidden');

  const setMode = (nextMode) => {
    mode = nextMode;
    const isView = mode === 'view';
    contextModal.dataset.mode = mode;
    contextModalTitle.textContent = isView ? 'Active interview setup' : 'Create new chat';
    contextModalSubtitle.textContent = isView
      ? 'Review the current resume, sliders, and toggles without interrupting the interview.'
      : 'Choose the resume, tune the interviewer, and launch.';
    contextSubmit.classList.toggle('hidden', isView);

    [
      ctxCompany,
      ctxRole,
      ctxWebSearch,
      ctxSilly,
      ctxCustomTone,
      ctxSeriousness,
      ctxStyle,
      ctxDifficulty,
      ctxComplexity,
    ].forEach((field) => {
      field.disabled = isView;
    });

    resumeCards.forEach((card) => {
      card.classList.toggle('is-readonly', isView);
    });
  };

  const populate = (context) => {
    ctxCompany.value = context.company || '';
    ctxRole.value = context.role || '';
    ctxWebSearch.checked = context.webSearchEnabled !== false;
    ctxSilly.checked = !!context.silly;
    ctxCustomTone.value = context.customTone || '';
    ctxSeriousness.value = context.seriousness ?? 0.5;
    ctxStyle.value = context.style ?? 0.5;
    ctxDifficulty.value = context.difficulty ?? 0.5;
    ctxComplexity.value = context.complexity ?? 0.5;
    updateSliderLabels();
    toggleCustomTone();
    syncSelectedResume(context.resumeId || '');
  };

  const read = () => ({
    company: ctxCompany.value.trim(),
    role: ctxRole.value.trim(),
    resumeId: ctxResume.value,
    backgroundDoc: '',
    webSearchEnabled: !!ctxWebSearch.checked,
    silly: ctxSilly.checked,
    customTone: (ctxCustomTone.value || '').trim().slice(0, 200),
    seriousness: parseFloat(ctxSeriousness.value),
    style: parseFloat(ctxStyle.value),
    difficulty: parseFloat(ctxDifficulty.value),
    complexity: parseFloat(ctxComplexity.value),
  });

  [ctxSeriousness, ctxStyle, ctxDifficulty, ctxComplexity].forEach((slider) => {
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
  ctxSilly.addEventListener('change', toggleCustomTone);
  closeModal.addEventListener('click', close);

  resumeCards.forEach((card) => {
    card.addEventListener('click', () => {
      if (mode === 'view') {
        return;
      }
      syncSelectedResume(card.dataset.resumeId);
    });
  });

  updateSliderLabels();
  toggleCustomTone();
  setMode('edit');

  return {
    open,
    close,
    setMode,
    populate,
    read,
    contextForm,
  };
};
