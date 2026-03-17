const { ObjectId } = require('mongodb');
const { ringColorForScore } = require('../utils/scoreColors');

const showResultsPage = async (req, res) => {
  const resumeIdParam = req.query?.resumeId;
  const resumeIdObj = resumeIdParam ? new ObjectId(resumeIdParam) : null;

  if (resumeIdObj && req.app.locals.collections?.resumeScores) {
    const scoresCol = req.app.locals.collections.resumeScores;
    const filesCol = req.app.locals.collections.resumeFiles;

    const scoreDoc = await scoresCol
      .find({ resumeId: resumeIdObj })
      .sort({ createdAt: -1 })
      .limit(1)
      .next();

    const fileDoc = filesCol
      ? await filesCol.findOne({ _id: resumeIdObj })
      : null;

    if (scoreDoc || fileDoc) {
      const rawScore = scoreDoc?.score ?? null;
      const fitScore =
        typeof rawScore === 'number'
          ? rawScore
          : Number.isFinite(Number(rawScore))
          ? Number(rawScore)
          : null;
      const ringColor = ringColorForScore(fitScore);

      return res.render('results', {
        fitScore,
        ringColor,
        scoreBreakdown: scoreDoc?.rubric || null,
        scoreTitle: scoreDoc?.title || 'Compatibility Score',
        positives: scoreDoc?.positives || [],
        negatives: scoreDoc?.negatives || [],
        summary: scoreDoc?.summary || '',
        company: scoreDoc?.company || '',
        jobSnippet: scoreDoc?.jobSnippet || '',
        resumeName: fileDoc?.originalName || 'Not provided',
        resumeSizeKb: fileDoc?.size ? Math.round(fileDoc.size / 1024) : null,
        resumeId: resumeIdParam,
      });
    }
  }

  // fallback empty render
  res.render('results', {
    fitScore: null,
    ringColor: '#555',
    scoreBreakdown: null,
    scoreTitle: 'Compatibility Score',
    positives: [],
    negatives: [],
    summary: '',
    company: '',
    jobSnippet: '',
    resumeName: 'Not provided',
    resumeSizeKb: null,
    resumeId: null,
  });
};

module.exports = { showResultsPage };
