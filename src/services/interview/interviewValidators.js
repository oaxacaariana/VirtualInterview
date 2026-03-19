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
    silly = false,
    seriousness = 0.5,
    style = 0.5,
    difficulty = 0.5,
    customTone = '',
    chatId,
  } = body;

  if (!resumeId || !company.trim() || !role.trim()) {
    const error = new Error('Resume, company, and role are required.');
    error.status = 400;
    throw error;
  }

  return {
    resumeId,
    company: company.trim(),
    role: role.trim(),
    interviewComplete,
    silly,
    seriousness,
    style,
    difficulty,
    customTone,
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
    silly = false,
    seriousness = 0.5,
    style = 0.5,
    difficulty = 0.5,
    customTone = '',
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

  return {
    prompt: prompt.trim(),
    transcript: Array.isArray(transcript) ? transcript : [],
    resumeId,
    company: company.trim(),
    role: role.trim(),
    interviewComplete,
    silly,
    seriousness,
    style,
    difficulty,
    customTone,
    chatId,
  };
};

module.exports = {
  requireConfiguredClient,
  validateStartInterviewInput,
  validateAskInterviewInput,
};
