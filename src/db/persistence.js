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

const buildChatLog = ({
  userId = null,
  sessionId,
  chatId,
  messages = [],
  model,
  status = 'in-progress',
  context = {},
}) => ({
  type: 'transcript',
  userId,
  sessionId,
  chatId,
  status,
  model,
  context: {
    resumeId: context.resumeId || null,
    company: context.company || '',
    role: context.role || '',
    backgroundDoc: context.backgroundDoc || '',
    resumeText: context.resumeText || '',
    jobDescription: context.jobDescription || '',
    researchSummary: context.researchSummary || '',
    webSignals: context.webSignals || '',
    silly: !!context.silly,
    customTone: context.customTone || '',
    seriousness: context.seriousness ?? 0.5,
    style: context.style ?? 0.5,
    difficulty: context.difficulty ?? 0.5,
    complexity: context.complexity ?? 0.5,
    webSearchEnabled: context.webSearchEnabled !== false,
  },
  messages: messages.map((m) => ({
    role: m.role,
    content: m.content,
    at: m.at || new Date(),
  })),
  createdAt: new Date(),
  updatedAt: new Date(),
});

const buildChatTurn = ({
  userId = null,
  sessionId,
  chatId,
  model,
  turn,
  questionAsked,
  prompt,
  reply,
  review = null,
}) => ({
  type: 'turn',
  userId,
  sessionId,
  chatId,
  model,
  turn,
  questionAsked,
  prompt,
  reply,
  review,
  createdAt: new Date(),
});

const buildInterviewScore = ({
  userId = null,
  sessionId,
  chatId,
  overallScore,
  grade = '',
  rubric = {},
  summary = '',
  strengths = [],
  improvements = [],
  strongestArea = '',
  weakestArea = '',
  patterns = '',
  reviewedTurns = 0,
}) => ({
  userId,
  sessionId,
  chatId,
  overallScore,
  grade,
  rubric,
  summary,
  strengths,
  improvements,
  strongestArea,
  weakestArea,
  patterns,
  reviewedTurns,
  createdAt: new Date(),
});

const buildResumeScore = ({
  userId = null,
  resumeId,
  score,
  rubric = null,
  title = 'Compatibility Score',
  summary,
  positives = [],
  negatives = [],
  company = '',
  jobSnippet = '',
}) => ({
  userId,
  resumeId,
  score,
  rubric,
  title,
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
  archived: false,
});

module.exports = {
  buildUser,
  buildChatLog,
  buildChatTurn,
  buildInterviewScore,
  buildResumeScore,
  buildResumeFile,
};
