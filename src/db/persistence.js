/**
 * Helper builders for MongoDB documents. These are not invoked yet,
 * but provide a consistent shape for future persistence.
 */

const buildUser = ({ email, name, role = 'candidate' }) => ({
  email: email?.toLowerCase(),
  name,
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

const buildResumeScore = ({ userId = null, resumeId, score, summary }) => ({
  userId,
  resumeId,
  score,
  summary,
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
  uploadedAt: new Date(),
});

module.exports = {
  buildUser,
  buildChatLog,
  buildInterviewScore,
  buildResumeScore,
  buildResumeFile,
};
