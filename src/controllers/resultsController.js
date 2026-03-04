const { ObjectId } = require('mongodb');

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
      const fitScore = scoreDoc?.score ?? null;
      const ringColor =
        fitScore === null
          ? '#555'
          : fitScore <= 20
          ? '#d64545'
          : fitScore <= 50
          ? '#f0a202'
          : fitScore <= 75
          ? '#8ac12f'
          : '#3fc26c';

      return res.render('results', {
        fitScore,
        ringColor,
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
