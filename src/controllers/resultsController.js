const showResultsPage = (req, res) => {
  // placeholders until we do rhe intergrations and all the other features  
  res.render('results', { 
    score: 'Pending...',
    verbalFeedback: 'Pending...',
    eyeContactFeedback: 'Pending...',
    postureFeedback: 'Pending...',
    improvementSuggestions: 'Pending...'
  });
  
};

module.exports = { showResultsPage };