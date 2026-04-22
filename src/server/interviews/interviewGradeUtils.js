/**
 * Interview grade utilities.
 * Inputs: Stored interview grade letters and numeric overall scores.
 * Outputs: Normalized grade labels plus DNF detection helpers.
 */
const MIN_REVIEWED_TURNS_FOR_FINAL_GRADE = 4;

const normalizeInterviewGrade = (storedGrade, score, reviewedTurns = 0) => {
  const normalizedStored = (storedGrade || '').toString().trim().toUpperCase();
  const reviewedTurnCount = Number(reviewedTurns);

  if (normalizedStored === 'P' || normalizedStored === 'DNF') {
    return 'DNF';
  }

  if (Number.isFinite(reviewedTurnCount) && reviewedTurnCount > 0 && reviewedTurnCount < MIN_REVIEWED_TURNS_FOR_FINAL_GRADE) {
    return 'DNF';
  }

  if (['A', 'B', 'C', 'D', 'F'].includes(normalizedStored)) {
    return normalizedStored;
  }

  const numericScore = Number(score);
  if (!Number.isFinite(numericScore)) {
    return 'DNF';
  }

  if (numericScore >= 85) return 'A';
  if (numericScore >= 70) return 'B';
  if (numericScore >= 50) return 'C';
  if (numericScore >= 35) return 'D';
  return 'F';
};

const isDnfInterviewScore = (finalScore) =>
  normalizeInterviewGrade(finalScore?.grade, finalScore?.overallScore, finalScore?.reviewedTurns) === 'DNF';

module.exports = {
  MIN_REVIEWED_TURNS_FOR_FINAL_GRADE,
  normalizeInterviewGrade,
  isDnfInterviewScore,
};
