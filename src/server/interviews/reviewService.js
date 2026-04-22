/**
 * Interview review service.
 * Inputs: OpenAI client, transcript content, turn context, resume/job context, and review scoring data.
 * Outputs: Normalized turn-level feedback and final interview review objects.
 */
const { interviewModel, reviewModel } = require('../shared/openaiClient');
const {
  INTERVIEW_REVIEW_WEIGHT_MAP,
  computeWeightedOverallScore,
  normalizeAreaLabel,
  normalizeCategoryScores,
  pickAreaLabel,
} = require('./interviewReviewRubric');
const { normalizeInterviewGrade } = require('./interviewGradeUtils');

const safeString = (value, fallback = '') =>
  typeof value === 'string' && value.trim() ? value.trim() : fallback;

const toTenScore = (value, fallback = 5) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(10, Math.max(1, Math.round(num)));
};

const toHundredScore = (value, fallback = 50) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(100, Math.max(0, Math.round(num)));
};

const clampFeedback = (value, fallback) => {
  const text = safeString(value, fallback);
  return text.slice(0, 1200);
};

const ensureThreeItems = (items, fallbacks) => {
  const normalized = Array.isArray(items)
    ? items.map((item) => safeString(item)).filter(Boolean).slice(0, 3)
    : [];

  for (const fallback of fallbacks) {
    if (normalized.length >= 3) break;
    normalized.push(fallback);
  }

  return normalized.slice(0, 3);
};

const normalizeTurnAnalysis = (raw, turnNumber) => {
  const verdict = safeString(raw?.verdict, 'mixed').toLowerCase();
  return {
    turnNumber,
    score: toTenScore(raw?.score, verdict === 'strong' ? 8 : verdict === 'weak' ? 4 : 6),
    verdict: ['strong', 'mixed', 'weak'].includes(verdict) ? verdict : 'mixed',
    questionAnswered: raw?.questionAnswered !== false,
    summary: clampFeedback(
      raw?.summary,
      'You addressed the question reasonably well, but the answer could be tighter, more focused, and more intentional.'
    ),
    positives: ensureThreeItems(raw?.positives, [
      'You stayed focused on what the interviewer actually asked.',
      'You gave enough context for the interviewer to follow your point.',
      'You kept a clear and professional baseline.',
    ]),
    negatives: ensureThreeItems(raw?.negatives, [
      'You could be clearer about what you personally did or decided.',
      'You could cut extra detail and get to the relevant point faster.',
      'You could tie the answer back to the role more explicitly when it matters.',
    ]),
  };
};

const normalizeFinalReview = (raw, reviewedTurns) => {
  const categoryScores = normalizeCategoryScores(raw?.categoryScores || {});
  const overallScore = computeWeightedOverallScore(categoryScores);
  const letterGrade = normalizeInterviewGrade('', overallScore, reviewedTurns);

  return {
    overallScore,
    letterGrade,
    categoryScores,
    overallSummary: clampFeedback(
      raw?.overallSummary,
      'You showed baseline interview readiness, but your answers need better focus, cleaner relevance, and stronger role-connected evidence to score as a strong performance.'
    ),
    strongestArea: normalizeAreaLabel(raw?.strongestArea, pickAreaLabel(categoryScores, 'strongest')),
    weakestArea: normalizeAreaLabel(raw?.weakestArea, pickAreaLabel(categoryScores, 'weakest')),
    patterns: clampFeedback(
      raw?.patterns,
      'Across the interview, your answers were directionally relevant but uneven in focus, specificity, and how cleanly you stayed on the actual question.'
    ),
    strengths: ensureThreeItems(raw?.strengths, [
      'You consistently engaged with the questions instead of completely losing the thread.',
      'You showed relevant experience and judgment that can be strengthened with sharper support.',
      'You maintained a generally professional and understandable baseline even when your answers were uneven.',
    ]),
    improvements: ensureThreeItems(raw?.improvements, [
      'Answer the exact question first, then add only the detail that helps prove your point.',
      'Use numbers or named specifics when they genuinely strengthen an impact claim, not by default.',
      'Cut filler and keep your examples focused so the interviewer can follow them in one pass.',
    ]),
    rubricWeights: INTERVIEW_REVIEW_WEIGHT_MAP,
    reviewedTurns,
  };
};

const parseJsonContent = (content) => {
  try {
    return JSON.parse(content);
  } catch {
    return null;
  }
};

const createTurnAnalysis = async ({
  openaiClient,
  turnNumber,
  company,
  role,
  mode = 'operating',
  gradingProfile = 'strict-operating-v1',
  personaLabel = 'Hiring Manager',
  backgroundDoc,
  questionAsked,
  candidateResponse,
}) => {
  const isStrictOperating = mode === 'operating' || gradingProfile === 'strict-operating-v1';
  const completion = await openaiClient.chat.completions.create({
    model: reviewModel,
    temperature: 0.2,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: [
          'You are a concise interview coach evaluating a single candidate answer.',
          'Decide whether the answer to the previous interview question was strong, mixed, or weak.',
          'Use only the provided question, candidate response, company, role, and background context.',
          'Do not reference any previous sessions or outside context.',
          isStrictOperating
            ? 'Operating mode rubric: grade harshly. Do not reward buzzwords, frameworks, or polished phrasing unless the answer proves direct ownership, relevant detail, reasoning, and actual understanding.'
            : 'Keep the analysis generic and practical, not heavily scored.',
          isStrictOperating
            ? 'Treat vague ownership, generic STAR language, shallow tradeoff analysis, irrelevant filler, and indirect answers as meaningful weaknesses. Do not require exact metrics, proper nouns, or named tools in every strong answer. Only penalize missing numbers when quantification would reasonably strengthen a claim about impact, scale, scope, or results.'
            : 'Keep the analysis grounded in the direct evidence of the answer.',
          'A concise answer can score well if it directly answers the question with enough specificity for that moment. Do not punish brevity when the question did not require a long story.',
          'Penalize answers that are bloated, wander away from the question, or add unnecessary detail that weakens the main point.',
          'The core test is whether the candidate understood what was being asked and responded with relevant, useful information.',
          'Return valid JSON only.',
          'Return exactly this shape: {"score":0,"verdict":"strong","questionAnswered":true,"summary":"","positives":["","",""],"negatives":["","",""]}',
          'score must be from 1 to 10 and reflect how effective the answer was for that question.',
          'summary must be 2 or 3 direct sentences in second person.',
          'Dont fill in positves and negatives with generic praise or criticism. Only give positives for clear strengths and negatives for clear weaknesses based on the evidence in the resume and job description. If there are no clear positives or negatives, return an empty array for each.',
          'If the candidate answers in an unreadble or encoded way, say so and mark questionAnswered as false.',  
        ].join(' '),
      },
      {
        role: 'user',
        content: [
          `Interview mode: ${mode}`,
          `Grading profile: ${gradingProfile}`,
          `Interviewer persona: ${personaLabel}`,
          `Company: ${company || 'Not provided.'}`,
          `Role: ${role || 'Not provided.'}`,
          `Background context: ${backgroundDoc || 'Not provided.'}`,
          `Previous interview question: ${questionAsked || 'Not available.'}`,
          `Candidate response: ${candidateResponse || 'Not provided.'}`,
        ].join('\n\n'),
      },
    ],
    max_tokens: 350,
  });

  const content = completion.choices?.[0]?.message?.content;
  const parsed = parseJsonContent(content);
  return normalizeTurnAnalysis(parsed, turnNumber);
};

const createFinalInterviewReview = async ({
  openaiClient,
  company,
  role,
  resumeText,
  jobDescription,
  mode = 'operating',
  gradingProfile = 'strict-operating-v1',
  personaLabel = 'Hiring Manager',
  difficulty = 0.5,
  turns,
}) => {
  const transcript = turns
    .map(
      (turn) => [
        `Turn ${turn.turn}`,
        `Question: ${turn.questionAsked || 'Not available.'}`,
        `Candidate response: ${turn.prompt || ''}`,
        `Interviewer follow-up: ${turn.reply || ''}`,
        `Inline positives: ${(turn.review?.positives || []).join('; ') || 'N/A'}`,
        `Inline negatives: ${(turn.review?.negatives || []).join('; ') || 'N/A'}`,
      ].join('\n')
    )
    .join('\n\n');

  const completion = await openaiClient.chat.completions.create({
    model: interviewModel,
    temperature: 0.3,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: [
          'You are an expert interview coach grading a completed interview.',
          'Use only the information explicitly provided in this request.',
          'Do not reference prior sessions, uploads, or outside context.',
          'Ground your evaluation in the actual transcript and turn reviews.',
          mode === 'operating' || gradingProfile === 'strict-operating-v1'
            ? 'Operating mode rubric: use a harsher bar than standard. Do not add leniency because the interview was difficult. Generic buzzwords, vague ownership, and low-evidence answers should materially reduce scores.'
            : 'Calibrate scoring against the selected interview difficulty: harder interviews should be graded more leniently for missed perfection, while easy interviews should be graded a bit more strictly.',
          mode === 'operating' || gradingProfile === 'strict-operating-v1'
            ? 'Reward direct relevance, clear ownership, appropriate specificity, concise focus, tradeoff reasoning, and responsiveness to follow-up pressure. Penalize shallow or bloated answers even if they sound polished.'
            : 'Reward practical relevance, clarity, and evidence from the transcript.',
          'Return valid JSON only.',
          'Do not require exact numbers, named tools, or proper nouns in every strong answer. In many real interviews, a strong answer is simply one that understands the question and answers it directly with the right amount of detail.',
          'Only expect quantitative metrics when the candidate is describing impact, scale, scope, performance, or results and a number would naturally strengthen credibility.',
          'Penalize answers that over-explain, drift off-topic, or bury the answer under unnecessary detail. Relevance and focus matter.',
          'Score these categories independently from 1 to 10: relevance = did the answer directly address the question and stay on point, star = how well the answer used a clear situation-task-action-result structure when depth was needed, roleAlignment = how strongly the answer proved fit for this role, clarity = how easy the answer was to follow and how appropriately focused it was, confidence = how credible and composed the delivery felt.',
          'Role alignment and relevance matter more than confidence. Do not inflate scores just because an answer sounds polished or uses interview buzzwords.',
          'overallScore and letterGrade are included for compatibility, but they will be recalculated downstream from the category scores. Focus on making the category scores accurate and evidence-based.',
          'Overall summary should be 5 to 8 sentences in second person.',
          'patterns should describe the repeated trends across the interview in 3 to 5 sentences.',
          'strengths and improvements must each contain exactly 0-5 concrete bullets. Do not include generic advice that isnt directly supported by the transcript and turn reviews. If there are no clear strengths or improvements, return an empty array for each. Be specific about what was good or needs improvement, and tie it to evidence from the transcript.',
          'Return exactly this shape: {"overallScore":0,"letterGrade":"","categoryScores":{"relevance":0,"star":0,"roleAlignment":0,"clarity":0,"confidence":0},"overallSummary":"","strongestArea":"","weakestArea":"","patterns":"","strengths":["","",""],"improvements":["","",""]}',
        ].join(' '),
      },
      {
        role: 'user',
        content: [
          `Interview mode:\n${mode}`,
          `Grading profile:\n${gradingProfile}`,
          `Interviewer persona:\n${personaLabel}`,
          `Job Description:\n${jobDescription || 'Not provided.'}`,
          `Company:\n${company || 'Not provided.'}`,
          `Role:\n${role || 'Not provided.'}`,
          `Selected interview difficulty (0-1):\n${difficulty}`,
          `Resume:\n${resumeText || 'Not provided.'}`,
          `Interview transcript and turn reviews:\n${transcript || 'No turns available.'}`,
        ].join('\n\n'),
      },
    ],
    max_tokens: 1500,
  });

  const content = completion.choices?.[0]?.message?.content;
  const parsed = parseJsonContent(content);
  return normalizeFinalReview(parsed, turns.length);
};

module.exports = {
  createTurnAnalysis,
  createFinalInterviewReview,
};
