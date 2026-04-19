/**
 * Interview input validation module.
 * Inputs: Raw request bodies for interview start and ask actions plus OpenAI client presence.
 * Outputs: Sanitized interview payloads or thrown HTTP-friendly validation errors.
 */
const { resolveInterviewContext } = require('./interviewConfig');

const requireConfiguredClient = (openaiClient) => {
  if (!openaiClient) {
    const error = new Error('OpenAI client not configured.');
    error.status = 500;
    throw error;
  }
};

const validateStartInterviewInput = (body = {}) => {
  const {
    resumeId,
    company = '',
    role = '',
    interviewComplete = false,
    backgroundDoc = '',
    resumeText = '',
    jobDescription = '',
    researchSummary = '',
    webSignals = '',
    webSearchEnabled = true,
    chatId,
  } = body;

  if (!resumeId || !company.trim() || !role.trim()) {
    const error = new Error('Resume, company, and role are required.');
    error.status = 400;
    throw error;
  }

  const resolvedContext = resolveInterviewContext(body);

  return {
    resumeId,
    company: company.trim(),
    role: role.trim(),
    interviewComplete,
    ...resolvedContext,
    backgroundDoc,
    resumeText,
    jobDescription,
    researchSummary,
    webSignals,
    webSearchEnabled,
    chatId,
  };
};

const validateAskInterviewInput = (body = {}) => {
  const {
    prompt,
    transcript = [],
    resumeId,
    company = '',
    role = '',
    interviewComplete = false,
    backgroundDoc = '',
    resumeText = '',
    jobDescription = '',
    researchSummary = '',
    webSignals = '',
    webSearchEnabled = true,
    chatId,
  } = body;

  if (!prompt || !prompt.trim()) {
    const error = new Error('Prompt is required.');
    error.status = 400;
    throw error;
  }

  if (!resumeId || !company.trim() || !role.trim()) {
    const error = new Error('Set company, role, and resume before chatting.');
    error.status = 400;
    throw error;
  }

  const resolvedContext = resolveInterviewContext(body);

  return {
    prompt: prompt.trim(),
    transcript: Array.isArray(transcript) ? transcript : [],
    resumeId,
    company: company.trim(),
    role: role.trim(),
    interviewComplete,
    ...resolvedContext,
    backgroundDoc,
    resumeText,
    jobDescription,
    researchSummary,
    webSignals,
    webSearchEnabled,
    chatId,
  };
};

module.exports = {
  requireConfiguredClient,
  validateStartInterviewInput,
  validateAskInterviewInput,
};
