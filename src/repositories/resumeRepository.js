const { ObjectId } = require('mongodb');

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
    $or: [
      { userId },
      { userId: sessionUser?.id || null },
    ],
  };

  if (activeOnly) {
    filter.archived = { $ne: true };
  }

  return filter;
};

const findOwnedResumeById = async (collections, sessionUser, resumeId, options = {}) => {
  const filter = buildOwnedResumeFilter(sessionUser, resumeId, options);
  if (!filter || !collections?.resumeFiles) {
    return null;
  }

  return collections.resumeFiles.findOne(filter);
};

const listActiveResumesWithScores = async (collections, sessionUser, { limit = 50 } = {}) => {
  const userId = toObjectId(sessionUser?.id);
  if (!collections?.resumeFiles || !userId) {
    return [];
  }

  const files = await collections.resumeFiles
    .find({
      $or: [{ userId }, { userId: sessionUser.id }],
      archived: { $ne: true },
    })
    .sort({ uploadedAt: -1 })
    .limit(limit)
    .toArray();

  if (!collections.resumeScores || files.length === 0) {
    return files;
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

  return files.map((file) => ({
    ...file,
    latestScore: scoreMap.get(file._id.toString()) || null,
  }));
};

module.exports = {
  toObjectId,
  buildOwnedResumeFilter,
  findOwnedResumeById,
  listActiveResumesWithScores,
};
