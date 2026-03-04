/**
 * Helper builders for MongoDB documents. These are not invoked yet,
 * but provide a consistent shape for future persistence.
 */

const buildUser = ({ username, name, passwordHash, role = 'candidate' }) => ({
  username: username?.toLowerCase(),
  name,
  passwordHash,
  role,
  createdAt: new Date(),
});

const buildChatLog = ({ userId = null, sessionId, messages = [], model }) => ({
  userId,
  sessionId,
  model,
  messages: messages.map((m) => ({
    role: m.role,
    content: m.content,
    at: m.at || new Date(),
  })),
  createdAt: new Date(),
});

const buildInterviewScore = ({
  userId = null,
  sessionId,
  overallScore,
  rubric = {},
  summary,
}) => ({
  userId,
  sessionId,
  overallScore,
  rubric,
  summary,
  createdAt: new Date(),
});

const buildResumeScore = ({
  userId = null,
  resumeId,
  score,
  summary,
  positives = [],
  negatives = [],
  company = '',
  jobSnippet = '',
}) => ({
  userId,
  resumeId,
  score,
  summary,
  positives,
  negatives,
  company,
  jobSnippet,
  createdAt: new Date(),
});

const buildResumeFile = ({
  userId = null,
  originalName,
  storedName,
  path,
  size,
  mimeType,
}) => ({
  userId,
  originalName,
  storedName,
  path,
  size,
  mimeType,
  // TODO: add parsedText once resume parser is implemented
  uploadedAt: new Date(),
});

module.exports = {
  buildUser,
  buildChatLog,
  buildInterviewScore,
  buildResumeScore,
  buildResumeFile,
};
