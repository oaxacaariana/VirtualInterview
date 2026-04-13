/**
 * Resume repository.
 * Inputs: Collections, session user state, resume identifiers, and resume/score payloads.
 * Outputs: Owned resume records, latest score joins, and persistence operations for resume data.
 */
const { ObjectId } = require('mongodb');
const { ringColorForScore } = require('../shared/scoreColors');

const toObjectId = (id) => {
  try {
    return typeof id === 'string' ? new ObjectId(id) : id;
  } catch {
    return null;
  }
};

const buildOwnedResumeFilter = (sessionUser, resumeId, { activeOnly = false } = {}) => {
  const userId = toObjectId(sessionUser?.id);
  const normalizedResumeId = toObjectId(resumeId);

  if (!userId || !normalizedResumeId) {
    return null;
  }

  const filter = {
    _id: normalizedResumeId,
    $or: [{ userId }, { userId: sessionUser?.id || null }],
  };

  if (activeOnly) {
    filter.archived = { $ne: true };
  }

  return filter;
};

const buildUserResumeFilter = (sessionUser, { archived = false } = {}) => {
  const userId = toObjectId(sessionUser?.id);
  if (!userId) {
    return null;
  }

  return {
    $or: [{ userId }, { userId: sessionUser?.id || null }],
    archived: archived ? true : { $ne: true },
  };
};

const hydrateResume = (resumeDoc, scoreDoc) => {
  const fitScore = scoreDoc?.score ?? null;

  return {
    ...resumeDoc,
    latestScore: scoreDoc || null,
    fitScore,
    fitSummary: scoreDoc?.summary || '',
    fitPositives: scoreDoc?.positives || [],
    fitNegatives: scoreDoc?.negatives || [],
    fitCompany: scoreDoc?.company || '',
    fitJobSnippet: scoreDoc?.jobSnippet || '',
    fitTitle: scoreDoc?.title || '',
    fitRubric: scoreDoc?.rubric || null,
    fitCreatedAt: scoreDoc?.createdAt || null,
    ringColor: ringColorForScore(fitScore),
  };
};

const findOwnedResumeById = async (collections, sessionUser, resumeId, options = {}) => {
  const filter = buildOwnedResumeFilter(sessionUser, resumeId, options);
  if (!filter || !collections?.resumeFiles) {
    return null;
  }

  return collections.resumeFiles.findOne(filter);
};

const findLatestScoreForResume = async (collections, resumeId) => {
  if (!collections?.resumeScores) {
    return null;
  }

  return collections.resumeScores
    .find({ resumeId: toObjectId(resumeId) })
    .sort({ createdAt: -1 })
    .limit(1)
    .next();
};

const findOwnedResumeWithLatestScore = async (collections, sessionUser, resumeId, options = {}) => {
  const resumeDoc = await findOwnedResumeById(collections, sessionUser, resumeId, options);
  if (!resumeDoc) {
    return null;
  }

  const latestScore = await findLatestScoreForResume(collections, resumeDoc._id);
  return hydrateResume(resumeDoc, latestScore);
};

const listResumesWithLatestScores = async (
  collections,
  sessionUser,
  { archived = false, limit = 50 } = {}
) => {
  const filter = buildUserResumeFilter(sessionUser, { archived });
  if (!filter || !collections?.resumeFiles) {
    return [];
  }

  const files = await collections.resumeFiles
    .find(filter)
    .sort({ uploadedAt: -1 })
    .limit(limit)
    .toArray();

  if (!collections.resumeScores || files.length === 0) {
    return files.map((file) => hydrateResume(file, null));
  }

  const ids = files.map((file) => file._id);
  const scores = await collections.resumeScores
    .find({ resumeId: { $in: ids } })
    .sort({ createdAt: -1 })
    .toArray();

  const scoreMap = new Map();
  scores.forEach((scoreDoc) => {
    const key = scoreDoc.resumeId?.toString();
    if (key && !scoreMap.has(key)) {
      scoreMap.set(key, scoreDoc);
    }
  });

  return files.map((file) => hydrateResume(file, scoreMap.get(file._id.toString()) || null));
};

const listActiveResumesWithScores = async (collections, sessionUser, { limit = 50 } = {}) =>
  listResumesWithLatestScores(collections, sessionUser, { archived: false, limit });

const insertResumeFile = async (collections, resumeDoc) => {
  if (!collections?.resumeFiles) {
    throw new Error('resumeFiles collection not available');
  }

  const { insertedId } = await collections.resumeFiles.insertOne(resumeDoc);
  return insertedId;
};

const insertResumeScore = async (collections, scoreDoc) => {
  if (!collections?.resumeScores) {
    throw new Error('resumeScores collection not available');
  }

  const { insertedId } = await collections.resumeScores.insertOne(scoreDoc);
  return insertedId;
};

const updateResumeArchiveState = async (collections, sessionUser, resumeId, archived) => {
  if (!collections?.resumeFiles) {
    return { matchedCount: 0, modifiedCount: 0 };
  }

  const filter = buildOwnedResumeFilter(sessionUser, resumeId);
  if (!filter) {
    return { matchedCount: 0, modifiedCount: 0 };
  }

  return collections.resumeFiles.updateOne(filter, { $set: { archived: !!archived } });
};

module.exports = {
  toObjectId,
  buildOwnedResumeFilter,
  buildUserResumeFilter,
  findOwnedResumeById,
  findLatestScoreForResume,
  findOwnedResumeWithLatestScore,
  listResumesWithLatestScores,
  listActiveResumesWithScores,
  insertResumeFile,
  insertResumeScore,
  updateResumeArchiveState,
};
