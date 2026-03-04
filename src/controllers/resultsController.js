const showResultsPage = (req, res) => {
  res.render('results', { 
    fitScore: 'Pending',
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
