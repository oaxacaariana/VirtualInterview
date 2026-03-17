const bcrypt = require('bcryptjs');
const { ObjectId } = require('mongodb');
const { ringColorForScore } = require('../utils/scoreColors');

const toObjectId = (id) => {
  try {
    return typeof id === 'string' ? new ObjectId(id) : id;
  } catch {
    return null;
  }
};

const showProfile = async (req, res) => {
  const userId = toObjectId(req.session?.user?.id);
  if (!userId) return res.redirect('/login');

  const users = req.app.locals.collections?.users;
  const resumeFiles = req.app.locals.collections?.resumeFiles;
  const resumeScores = req.app.locals.collections?.resumeScores;

  const user = users ? await users.findOne({ _id: userId }) : null;
  if (user && req.session?.user) {
    req.session.user.name = user.name;
  }
  const resumes = resumeFiles
    ? await resumeFiles
        .find({
          $or: [
            { userId },
            { userId: req.session?.user?.id || null }, // fallback for legacy string/null entries
          ],
          archived: { $ne: true },
        })
        .sort({ uploadedAt: -1 })
        .limit(20)
        .toArray()
    : [];

  // attach latest score per resume
  if (resumeScores && resumes.length) {
    const ids = resumes.map((r) => r._id);
    const scores = await resumeScores
      .find({ resumeId: { $in: ids } })
      .sort({ createdAt: -1 })
      .toArray();

    const scoreMap = new Map();
    scores.forEach((s) => {
      if (!scoreMap.has(s.resumeId.toString())) {
        scoreMap.set(s.resumeId.toString(), s);
      }
    });

    resumes.forEach((r) => {
      const match = scoreMap.get(r._id.toString());
      if (match) {
        r.fitScore = match.score;
        r.fitSummary = match.summary;
        r.fitPositives = match.positives;
        r.fitNegatives = match.negatives;
        r.fitCompany = match.company;
        r.fitJobSnippet = match.jobSnippet;
        r.fitTitle = match.title;
        r.fitRubric = match.rubric;
      }
      r.ringColor = ringColorForScore(r.fitScore);
    });
  }

  res.render('profile', {
    user,
    resumes,
    error: null,
    success: null,
  });
};

const updateProfile = async (req, res) => {
  const userId = toObjectId(req.session?.user?.id);
  if (!userId) return res.redirect('/login');

  const { name, password } = req.body || {};
  const users = req.app.locals.collections?.users;
  if (!users) {
    return res.render('profile', {
      user: null,
      resumes: [],
      error: 'User store unavailable.',
      success: null,
    });
  }

  const updates = {};
  if (name) updates.name = name;
  if (password) {
    updates.passwordHash = await bcrypt.hash(password, 10);
  }

  if (Object.keys(updates).length === 0) {
    const user = await users.findOne({ _id: userId });
    const resumes = await req.app.locals.collections.resumeFiles
      .find({ userId, archived: { $ne: true } })
      .sort({ uploadedAt: -1 })
      .limit(20)
      .toArray();
    return res.render('profile', {
      user,
      resumes,
      error: 'No changes submitted.',
      success: null,
    });
  }

  await users.updateOne({ _id: userId }, { $set: updates });
  // refresh session user name
  const refreshed = await users.findOne({ _id: userId });
  req.session.user = {
    id: refreshed._id,
    username: refreshed.username,
    name: refreshed.name,
  };

  const resumeFiles = req.app.locals.collections.resumeFiles;
  const resumeScores = req.app.locals.collections.resumeScores;

  const resumes = await resumeFiles
    .find({
      $or: [
        { userId },
        { userId: req.session?.user?.id || null },
      ],
      archived: { $ne: true },
    })
    .sort({ uploadedAt: -1 })
    .limit(20)
    .toArray();

  if (resumeScores && resumes.length) {
    const ids = resumes.map((r) => r._id);
    const scores = await resumeScores
      .find({ resumeId: { $in: ids } })
      .sort({ createdAt: -1 })
      .toArray();

    const scoreMap = new Map();
    scores.forEach((s) => {
      if (!scoreMap.has(s.resumeId.toString())) {
        scoreMap.set(s.resumeId.toString(), s);
      }
    });

    resumes.forEach((r) => {
      const match = scoreMap.get(r._id.toString());
      if (match) {
        r.fitScore = match.score;
        r.fitSummary = match.summary;
        r.fitPositives = match.positives;
        r.fitNegatives = match.negatives;
        r.fitCompany = match.company;
        r.fitJobSnippet = match.jobSnippet;
        r.fitTitle = match.title;
        r.fitRubric = match.rubric;
      }
      r.ringColor = ringColorForScore(r.fitScore);
    });
  }

  res.render('profile', {
    user: refreshed,
    resumes,
    error: null,
    success: 'Profile updated.',
  });
};

module.exports = { showProfile, updateProfile };
