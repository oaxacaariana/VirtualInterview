export const createContextModal = (elements) => {
  const {
    contextModal,
    closeModal,
    contextForm,
    ctxCompany,
    ctxRole,
    ctxResume,
    ctxSilly,
    ctxCustomTone,
    ctxSeriousness,
    ctxStyle,
    ctxDifficulty,
    seriousnessVal,
    styleVal,
    difficultyVal,
    resumeCards,
  } = elements;

  const updateSliderLabels = () => {
    seriousnessVal.textContent = ctxSeriousness.value;
    styleVal.textContent = ctxStyle.value;
    difficultyVal.textContent = ctxDifficulty.value;
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

  const populate = (context) => {
    ctxCompany.value = context.company || '';
    ctxRole.value = context.role || '';
    ctxSilly.checked = !!context.silly;
    ctxCustomTone.value = context.customTone || '';
    ctxSeriousness.value = context.seriousness ?? 0.5;
    ctxStyle.value = context.style ?? 0.5;
    ctxDifficulty.value = context.difficulty ?? 0.5;
    updateSliderLabels();
    toggleCustomTone();
    syncSelectedResume(context.resumeId || '');
  };

  const read = () => ({
    company: ctxCompany.value.trim(),
    role: ctxRole.value.trim(),
    resumeId: ctxResume.value,
    silly: ctxSilly.checked,
    customTone: (ctxCustomTone.value || '').trim().slice(0, 200),
    seriousness: parseFloat(ctxSeriousness.value),
    style: parseFloat(ctxStyle.value),
    difficulty: parseFloat(ctxDifficulty.value),
  });

  [ctxSeriousness, ctxStyle, ctxDifficulty].forEach((slider) => {
    slider.addEventListener('input', updateSliderLabels);
  });
  ctxSilly.addEventListener('change', toggleCustomTone);
  closeModal.addEventListener('click', close);

  resumeCards.forEach((card) => {
    card.addEventListener('click', () => {
      syncSelectedResume(card.dataset.resumeId);
    });
  });

  updateSliderLabels();
  toggleCustomTone();

  return {
    open,
    close,
    populate,
    read,
    contextForm,
  };
};
