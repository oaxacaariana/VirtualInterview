const ringColorForScore = (score) => {
  if (typeof score !== 'number') return '#555';
  if (score <= 20) return '#d64545';
  if (score <= 50) return '#f0a202';
  if (score <= 75) return '#8ac12f';
  return '#3fc26c';
};

module.exports = { ringColorForScore };
