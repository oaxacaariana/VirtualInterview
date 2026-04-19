/**
 * Shared interview configuration.
 * Inputs: Raw UI/server context values for interview mode and persona.
 * Outputs: Resolved interview settings used consistently by prompts, grading, persistence, and TTS.
 */
const OPERATING_MODE = 'operating';
const CRAZY_MODE = 'crazy';
const DEFAULT_MODE_ID = OPERATING_MODE;
const DEFAULT_PERSONA_ID = 'skeptical-manager';
const VOICE_OPTIONS = [
  { id: 'alloy', label: 'Alloy' },
  { id: 'ash', label: 'Ash' },
  { id: 'ballad', label: 'Ballad' },
  { id: 'cedar', label: 'Cedar' },
  { id: 'coral', label: 'Coral' },
  { id: 'echo', label: 'Echo' },
  { id: 'fable', label: 'Fable' },
  { id: 'marin', label: 'Marin' },
  { id: 'nova', label: 'Nova' },
  { id: 'onyx', label: 'Onyx' },
  { id: 'sage', label: 'Sage' },
  { id: 'shimmer', label: 'Shimmer' },
  { id: 'verse', label: 'Verse' },
];
const VOICE_OPTION_IDS = new Set(VOICE_OPTIONS.map((voice) => voice.id));

const clamp01 = (value, fallback = 0.5) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  if (num < 0) return 0;
  if (num > 1) return 1;
  return num;
};

const safeText = (value, fallback = '') =>
  typeof value === 'string' && value.trim() ? value.trim() : fallback;

const PERSONAS = [
  {
    id: 'skeptical-manager',
    label: 'Skeptical Manager',
    interviewerName: 'Dorian',
    summary:
      'Evidence-first and suspicious of polished fluff. Pushes hard on ownership, metrics, and whether you actually did the work.',
    chips: ['Direct', 'Evidence-first', 'High pressure'],
    voice: 'onyx',
    ttsInstructions:
      'Speak like a skeptical hiring manager. Keep the delivery firm, clipped, and highly attentive to weak claims.',
    operatingLevels: {
      seriousness: 0.95,
      style: 0.98,
      difficulty: 1,
      complexity: 1,
    },
    promptStyle:
      'Persona: skeptical hiring manager. You are sharp, controlled, and evidence-driven. Challenge vague claims quickly and make the candidate prove ownership, judgment, and measurable impact.',
  },
  {
    id: 'executive-operator',
    label: 'Executive Operator',
    interviewerName: 'Helena',
    summary:
      'Polished, strategic, and senior. Focuses on prioritization, cross-functional judgment, scope, and business impact.',
    chips: ['Strategic', 'Polished', 'Leadership'],
    voice: 'alloy',
    ttsInstructions:
      'Speak like a polished executive interviewer. Sound calm, authoritative, deliberate, and senior.',
    operatingLevels: {
      seriousness: 0.98,
      style: 0.76,
      difficulty: 1,
      complexity: 1,
    },
    promptStyle:
      'Persona: executive operator. You sound polished, strategic, and senior. Focus on prioritization, judgment, leadership tradeoffs, and business outcomes while keeping the same strict bar.',
  },
  {
    id: 'technical-griller',
    label: 'Technical Griller',
    interviewerName: 'Marcus',
    summary:
      'Calm but demanding. Drives into implementation details, tradeoffs, failure modes, and why a decision was made.',
    chips: ['Technical', 'Tradeoff-heavy', 'Analytical'],
    voice: 'echo',
    ttsInstructions:
      'Speak like a highly analytical technical interviewer. Keep the tone calm, precise, and intensely focused on technical depth.',
    operatingLevels: {
      seriousness: 0.94,
      style: 0.9,
      difficulty: 1,
      complexity: 1,
    },
    promptStyle:
      'Persona: technical griller. You are analytical, exact, and systematic. Press on architecture, edge cases, tradeoffs, failure modes, and operational reality without lowering the scrutiny.',
  },
  {
    id: 'supportive-exacting',
    label: 'Aria',
    interviewerName: 'Aria',
    summary:
      'The original interviewer voice, now tuned into a warmer but still exacting professional experience with the same hard standard.',
    chips: ['Warm', 'Structured', 'Original favorite'],
    voice: 'nova',
    ttsInstructions:
      'Speak like a warm but exacting interviewer. Sound clear, supportive, and composed while maintaining a firm professional standard.',
    operatingLevels: {
      seriousness: 0.84,
      style: 0.34,
      difficulty: 1,
      complexity: 1,
    },
    promptStyle:
      'Persona: supportive but exacting interviewer. You sound warm and composed, but you never lower the bar. Give the candidate room to respond, then calmly force precision, evidence, and cleaner reasoning.',
  },
  {
    id: 'empathetic-recruiter',
    label: 'Empathetic Recruiter',
    interviewerName: 'Naomi',
    summary:
      'Warm, polished, and disarming at first, but still tuned to substance. Great for realistic recruiter-screen energy with a real bar behind it.',
    chips: ['Warm screen', 'Polished', 'Human'],
    voice: 'marin',
    ttsInstructions:
      'Speak like an empathetic but sharp recruiter. Sound warm, natural, and engaging up front, then slightly more probing when you need specifics. Use smooth conversational inflection and light encouragement without sounding overly cheerful.',
    operatingLevels: {
      seriousness: 0.78,
      style: 0.22,
      difficulty: 1,
      complexity: 1,
    },
    promptStyle:
      'Persona: empathetic recruiter. You sound warm, human, and easy to talk to, but you still evaluate substance carefully. Build quick rapport, then test motivation, communication, consistency, and whether the candidate can back up their claims with specifics.',
  },
  {
    id: 'founder-operator',
    label: 'Founder Operator',
    interviewerName: 'Rhea',
    summary:
      'Fast-moving, decisive, and commercially sharp. Pushes on ownership, urgency, tradeoffs, and whether the candidate can operate without hand-holding.',
    chips: ['Startup', 'Decisive', 'High ownership'],
    voice: 'cedar',
    ttsInstructions:
      'Speak like a sharp startup founder-interviewer. Sound brisk, decisive, and highly engaged. Keep the pacing energetic, the emphasis intentional, and the tone commercially minded without becoming theatrical.',
    operatingLevels: {
      seriousness: 0.92,
      style: 0.84,
      difficulty: 1,
      complexity: 1,
    },
    promptStyle:
      'Persona: founder operator. You are quick, direct, and commercially serious. Focus on execution speed, ownership, prioritization, ambiguity, tradeoffs, and whether the candidate can deliver in a high-accountability environment.',
  },
];

const PERSONA_BY_ID = Object.fromEntries(PERSONAS.map((persona) => [persona.id, persona]));

const MODES = {
  [OPERATING_MODE]: {
    id: OPERATING_MODE,
    label: 'Operating Mode',
    summary:
      'Fixed maximum scrutiny. Hard follow-ups, harder grading, and no leniency for buzzword-only answers.',
    gradingProfile: 'strict-operating-v1',
    scrutinyProfile: 'strict-operating-v1',
  },
  [CRAZY_MODE]: {
    id: CRAZY_MODE,
    label: 'Crazy Mode',
    summary:
      'Playful and experimental. Personality stays selected, but sliders and custom tone unlock for weird interviewer variants.',
    gradingProfile: 'crazy-adjustable-v1',
    scrutinyProfile: 'user-tuned-crazy-v1',
  },
};

const getPersonaById = (personaId) => PERSONA_BY_ID[personaId] || PERSONA_BY_ID[DEFAULT_PERSONA_ID];

const resolveInterviewContext = (input = {}) => {
  const legacyCrazy = !!input.silly;
  const mode = input.mode === CRAZY_MODE || input.mode === OPERATING_MODE
    ? input.mode
    : legacyCrazy
      ? CRAZY_MODE
      : DEFAULT_MODE_ID;
  const persona = getPersonaById(input.personaId);
  const modeConfig = MODES[mode] || MODES[DEFAULT_MODE_ID];
  const requestedVoice = safeText(input.ttsVoice).toLowerCase();
  const resolvedVoice = VOICE_OPTION_IDS.has(requestedVoice) ? requestedVoice : persona.voice;

  const resolvedLevels =
    mode === OPERATING_MODE
      ? {
          seriousness: persona.operatingLevels.seriousness,
          style: persona.operatingLevels.style,
          difficulty: persona.operatingLevels.difficulty,
          complexity: persona.operatingLevels.complexity,
        }
      : {
          seriousness: clamp01(input.seriousness, 0.5),
          style: clamp01(input.style, 0.5),
          difficulty: clamp01(input.difficulty, 0.6),
          complexity: clamp01(input.complexity, 0.6),
        };

  return {
    mode,
    modeLabel: modeConfig.label,
    personaId: persona.id,
    personaLabel: persona.label,
    personaSummary: persona.summary,
    personaPromptStyle: persona.promptStyle,
    interviewerName: persona.interviewerName,
    ttsVoice: resolvedVoice,
    ttsInstructions: persona.ttsInstructions,
    gradingProfile: modeConfig.gradingProfile,
    scrutinyProfile: modeConfig.scrutinyProfile,
    webSearchEnabled: input.webSearchEnabled !== false,
    silly: mode === CRAZY_MODE,
    customTone: mode === CRAZY_MODE ? safeText(input.customTone).slice(0, 200) : '',
    seriousness: resolvedLevels.seriousness,
    style: resolvedLevels.style,
    difficulty: resolvedLevels.difficulty,
    complexity: resolvedLevels.complexity,
  };
};

const getInterviewClientConfig = () => ({
  defaultModeId: DEFAULT_MODE_ID,
  defaultPersonaId: DEFAULT_PERSONA_ID,
  modes: Object.values(MODES).map((mode) => ({
    id: mode.id,
    label: mode.label,
    summary: mode.summary,
  })),
  personas: PERSONAS.map((persona) => ({
    id: persona.id,
    label: persona.label,
    interviewerName: persona.interviewerName,
    summary: persona.summary,
    voice: persona.voice,
    chips: persona.chips,
  })),
  voiceOptions: VOICE_OPTIONS,
});

module.exports = {
  CRAZY_MODE,
  DEFAULT_MODE_ID,
  DEFAULT_PERSONA_ID,
  MODES,
  OPERATING_MODE,
  PERSONAS,
  VOICE_OPTIONS,
  getInterviewClientConfig,
  getPersonaById,
  resolveInterviewContext,
};
