const { ObjectId } = require('mongodb');
const { ringColorForScore } = require('../utils/scoreColors');

const toObjectId = (id) => {
  try {
    return typeof id === 'string' ? new ObjectId(id) : id;
  } catch {
    return null;
  }
};

const fetchUserResumesWithScores = async (req, { archived = false } = {}) => {
  const userId = toObjectId(req.session?.user?.id);
  if (!userId) return { user: null, resumes: [] };

  const users = req.app.locals.collections?.users;
  const resumeFiles = req.app.locals.collections?.resumeFiles;
  const resumeScores = req.app.locals.collections?.resumeScores;

  const user = users ? await users.findOne({ _id: userId }) : null;
  const resumeFilter = {
    $or: [
      { userId },
      { userId: req.session?.user?.id || null }, // legacy string/null support
    ],
  };
  resumeFilter.archived = archived ? true : { $ne: true };

  const resumes = resumeFiles
    ? await resumeFiles
        .find(resumeFilter)
        .sort({ uploadedAt: -1 })
        .limit(50)
        .toArray()
    : [];

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
        r.fitCreatedAt = match.createdAt;
      }
      r.ringColor = ringColorForScore(r.fitScore);
    });
  }

  return { user, resumes };
};

const showResumes = async (req, res) => {
  const showArchived = req.query?.archived === '1';
  const { user, resumes } = await fetchUserResumesWithScores(req, { archived: showArchived });
  res.render('resumes', {
    user,
    resumes,
    error: null,
    showArchived,
  });
};

const archiveResume = async (req, res) => {
  const resumeId = toObjectId(req.params.id);
  const userId = toObjectId(req.session?.user?.id);
  if (!resumeId || !userId) return res.redirect('/resumes');

  const resumeFiles = req.app.locals.collections?.resumeFiles;
  if (!resumeFiles) return res.redirect('/resumes');

  await resumeFiles.updateOne(
    { _id: resumeId, $or: [{ userId }, { userId: req.session?.user?.id || null }] },
    { $set: { archived: true } }
  );
  res.redirect(req.get('referer') || '/resumes');
};

const unarchiveResume = async (req, res) => {
  const resumeId = toObjectId(req.params.id);
  const userId = toObjectId(req.session?.user?.id);
  if (!resumeId || !userId) return res.redirect('/resumes?archived=1');

  const resumeFiles = req.app.locals.collections?.resumeFiles;
  if (!resumeFiles) return res.redirect('/resumes?archived=1');

  await resumeFiles.updateOne(
    { _id: resumeId, $or: [{ userId }, { userId: req.session?.user?.id || null }] },
    { $set: { archived: false } }
  );
  res.redirect(req.get('referer') || '/resumes?archived=1');
};

module.exports = { showResumes, archiveResume, unarchiveResume };
