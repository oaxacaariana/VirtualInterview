/**
 * Interview review rubric helpers.
 * Inputs: Raw category scores, freeform area labels, and persisted interview score records.
 * Outputs: Weighted overall scores plus normalized area labels and score records.
 */
const { normalizeInterviewGrade } = require('./interviewGradeUtils');

const INTERVIEW_REVIEW_CATEGORIES = Object.freeze([
  { key: 'roleAlignment', label: 'Role fit', weight: 0.3 },
  { key: 'relevance', label: 'Relevance', weight: 0.26 },
  { key: 'star', label: 'Structured answers', weight: 0.22 },
  { key: 'clarity', label: 'Clarity', weight: 0.14 },
  { key: 'confidence', label: 'Confidence', weight: 0.08 },
]);

const INTERVIEW_REVIEW_CATEGORY_KEYS = INTERVIEW_REVIEW_CATEGORIES.map((category) => category.key);
const INTERVIEW_REVIEW_CATEGORY_MAP = Object.fromEntries(
  INTERVIEW_REVIEW_CATEGORIES.map((category) => [category.key, category])
);
const INTERVIEW_REVIEW_WEIGHT_MAP = Object.freeze(
  Object.fromEntries(INTERVIEW_REVIEW_CATEGORIES.map((category) => [category.key, category.weight]))
);

const clampCategoryScore = (value, fallback = 5) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(10, Math.max(1, Math.round(num)));
};

const normalizeCategoryScores = (scores = {}) => ({
  relevance: clampCategoryScore(scores.relevance, 5),
  star: clampCategoryScore(scores.star, 5),
  roleAlignment: clampCategoryScore(scores.roleAlignment, 5),
  clarity: clampCategoryScore(scores.clarity, 5),
  confidence: clampCategoryScore(scores.confidence, 5),
});

const hasKnownRubricScores = (scores = {}) =>
  INTERVIEW_REVIEW_CATEGORY_KEYS.some((key) => scores?.[key] != null);

const computeWeightedOverallScore = (scores = {}) => {
  const normalized = normalizeCategoryScores(scores);
  const weightedTotal = INTERVIEW_REVIEW_CATEGORIES.reduce(
    (sum, category) => sum + normalized[category.key] * category.weight,
    0
  );

  return Math.max(0, Math.min(100, Math.round(weightedTotal * 10)));
};

const normalizeAreaKey = (value) => {
  const text = String(value || '').trim().toLowerCase();
  if (!text) return '';
  if (text.includes('role')) return 'roleAlignment';
  if (text.includes('relev')) return 'relevance';
  if (text.includes('clar')) return 'clarity';
  if (text.includes('confid') || text.includes('presence') || text.includes('delivery')) return 'confidence';
  if (
    text.includes('star') ||
    text.includes('structur') ||
    text.includes('example') ||
    text.includes('story') ||
    text.includes('situation') ||
    text.includes('result')
  ) {
    return 'star';
  }
  return '';
};

const labelForAreaKey = (key, fallback = '') => INTERVIEW_REVIEW_CATEGORY_MAP[key]?.label || fallback;

const normalizeAreaLabel = (value, fallback = '') => {
  const key = normalizeAreaKey(value);
  if (key) {
    return labelForAreaKey(key, fallback);
  }

  const text = typeof value === 'string' && value.trim() ? value.trim() : '';
  return text || fallback;
};

const pickAreaLabel = (scores = {}, mode = 'strongest') => {
  const normalized = normalizeCategoryScores(scores);
  const ranked = [...INTERVIEW_REVIEW_CATEGORIES].sort((left, right) => {
    if (mode === 'weakest') {
      return normalized[left.key] - normalized[right.key] || right.weight - left.weight;
    }

    return normalized[right.key] - normalized[left.key] || right.weight - left.weight;
  });

  return ranked[0]?.label || 'Role fit';
};

const normalizeInterviewScoreRecord = (record) => {
  if (!record) return null;

  const rawScores = record.rubric || record.categoryScores || {};
  const reviewedTurns = Number(record.reviewedTurns) || 0;

  if (!hasKnownRubricScores(rawScores)) {
    const numericScore = Number(record.overallScore);
    const overallScore = Number.isFinite(numericScore) ? Math.max(0, Math.min(100, Math.round(numericScore))) : 0;
    const letterGrade = normalizeInterviewGrade(record.grade || record.letterGrade, overallScore, reviewedTurns);

    return {
      ...record,
      overallScore,
      grade: letterGrade,
      letterGrade,
      rubricWeights: INTERVIEW_REVIEW_WEIGHT_MAP,
    };
  }

  const rubric = normalizeCategoryScores(rawScores);
  const overallScore = computeWeightedOverallScore(rubric);
  const letterGrade = normalizeInterviewGrade('', overallScore, reviewedTurns);

  return {
    ...record,
    overallScore,
    grade: letterGrade,
    letterGrade,
    rubric,
    categoryScores: rubric,
    strongestArea: normalizeAreaLabel(record.strongestArea, pickAreaLabel(rubric, 'strongest')),
    weakestArea: normalizeAreaLabel(record.weakestArea, pickAreaLabel(rubric, 'weakest')),
    rubricWeights: INTERVIEW_REVIEW_WEIGHT_MAP,
  };
};

module.exports = {
  INTERVIEW_REVIEW_CATEGORIES,
  INTERVIEW_REVIEW_WEIGHT_MAP,
  computeWeightedOverallScore,
  hasKnownRubricScores,
  labelForAreaKey,
  normalizeAreaLabel,
  normalizeCategoryScores,
  normalizeInterviewScoreRecord,
  pickAreaLabel,
};
