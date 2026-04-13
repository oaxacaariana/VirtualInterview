/**
 * Resume scoring service.
 * Inputs: Uploaded resume files, job/company context, environment-configured OpenAI access, and collections.
 * Outputs: Parsed scoring results plus persisted resume file and resume score records.
 */
const OpenAI = require('openai');
const { buildResumeFile, buildResumeScore } = require('../data/persistence');
const { parseResumeToText } = require('../shared/resumeParser');
const { runWebResearch } = require('../shared/webResearch');
const { toObjectId, insertResumeFile, insertResumeScore } = require('./resumeRepository');

const model = process.env.MODEL || 'gpt-4.1-mini';
const MAX_STRICTNESS = 1;
let client;

const getScoringClient = () => {
  if (!process.env.OPENAI_API_KEY) {
    return null;
  }

  if (!client) {
    client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  return client;
};

const inferRoleFromJobDescription = (desc) => {
  if (!desc) return '';
  const firstLine = desc.split(/\r?\n/).find((line) => line.trim().length > 0) || '';
  return firstLine.trim().slice(0, 120);
};

const clamp01 = (value, fallback = 0.5) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(1, Math.max(0, num));
};

const isEnabledField = (value, fallback = false) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['on', 'true', '1', 'yes'].includes(normalized)) return true;
    if (['off', 'false', '0', 'no'].includes(normalized)) return false;
  }
  return fallback;
};

const clampScore = (value, max) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  return Math.min(Math.max(Math.round(num), 0), max);
};

const applyQualityCaps = (score, breakdown) => {
  const capped = Number(score) || 0;
  const severeCap = MAX_STRICTNESS >= 0.75 ? 52 : MAX_STRICTNESS >= 0.6 ? 55 : 59;
  const moderateCap = MAX_STRICTNESS >= 0.75 ? 62 : MAX_STRICTNESS >= 0.6 ? 65 : 69;

  if (
    breakdown.resume_completeness <= 4 ||
    breakdown.professional_structure_clarity <= 4 ||
    breakdown.experience_depth <= 8
  ) {
    return Math.min(capped, severeCap);
  }

  if (
    breakdown.resume_completeness <= 6 ||
    breakdown.professional_structure_clarity <= 6 ||
    breakdown.skills_evidence_alignment <= 5 ||
    breakdown.project_quality <= 2
  ) {
    return Math.min(capped, moderateCap);
  }

  return capped;
};

const getStrictnessPrompt = () =>
  [
    'Scoring strictness: very high.',
    'Use a highly skeptical hiring bar.',
    'Only reward clearly proven depth, strong evidence, and repeated specificity.',
    'Thin or underexplained resumes should score sharply lower.',
    'Do not let a resume feel strong unless it would hold up under close recruiter and hiring-manager review.',
  ].join(' ');

const readResumeText = async (filePath) => {
  try {
    return (await parseResumeToText(filePath)).slice(0, 8000);
  } catch (error) {
    console.error('Unable to parse resume file:', error);
    return '';
  }
};

const getFitAssessment = async ({ resumeText, jobDescription, company, webResearch }) => {
  const scoringClient = getScoringClient();
  const completion = await scoringClient.chat.completions.create({
    model,
    temperature: 0.4,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: [
          `You are a hiring manager at ${company || 'the target company'}.`,
          'Evaluate both role fit and resume quality with a strict standard.',
          getStrictnessPrompt(),
          'Be skeptical and conservative. Do not assume competence from brevity, polish, or keyword overlap.',
          "Compare the candidate's skills, experience, education, project depth, and written evidence against the job description and inferred company expectations.",
          'Return JSON only with keys: title, role_fit, experience_depth, quantified_impact, skills_evidence_alignment, resume_completeness, professional_structure_clarity, project_quality, education_certifications, compatibility_score, positives, negatives, summary.',
          'Do not reward keyword overlap without evidence.',
          'If the resume is thin, vague, or underexplained, score lower rather than higher.',
          'compatibility_score must equal the sum of the eight components, capped at 100.',
          `Use these web research cues for context: ${webResearch || 'none available'}.`,
          'If the uploaded file is not a resume or is unreadable, say so and give it a zero score.',
        ].join(' '),
      },
      {
        role: 'user',
        content: [
          `Job description:\n${jobDescription || 'N/A'}`,
          `Company/role web research:\n${webResearch || 'No external signals found.'}`,
          `Resume:\n${resumeText || 'Resume text unavailable.'}`,
        ].join('\n\n'),
      },
    ],
  });

  const content = completion.choices?.[0]?.message?.content;
  if (!content) return null;

  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch (error) {
    console.warn('Failed to parse assessment JSON:', error.message);
    return null;
  }

  const breakdown = {
    role_fit: clampScore(parsed.role_fit, 25),
    experience_depth: clampScore(parsed.experience_depth, 20),
    quantified_impact: clampScore(parsed.quantified_impact, 15),
    skills_evidence_alignment: clampScore(parsed.skills_evidence_alignment, 10),
    resume_completeness: clampScore(parsed.resume_completeness, 10),
    professional_structure_clarity: clampScore(parsed.professional_structure_clarity, 10),
    project_quality: clampScore(parsed.project_quality, 5),
    education_certifications: clampScore(parsed.education_certifications, 5),
  };

  const computedTotal = Object.values(breakdown).reduce((sum, value) => sum + value, 0);
  return {
    title: (parsed.title || 'Resume Strength & Role Fit').toString().trim() || 'Resume Strength & Role Fit',
    compatibility_score: applyQualityCaps(Math.min(100, computedTotal), breakdown),
    breakdown,
    positives: Array.isArray(parsed.positives) ? parsed.positives.filter(Boolean) : [],
    negatives: Array.isArray(parsed.negatives) ? parsed.negatives.filter(Boolean) : [],
    summary: parsed.summary ? parsed.summary.toString().trim() : '',
  };
};

const createResumeAssessment = async ({
  collections,
  sessionUser,
  file,
  company = '',
  jobDescription = '',
  webSearchEnabled = true,
}) => {
  const jobDescForLLM = jobDescription.slice(0, 4000);
  const jobDescForDisplay = jobDescription.slice(0, 700);
  const userObjectId = toObjectId(sessionUser?.id);

  const resumeDoc = buildResumeFile({
    userId: userObjectId,
    originalName: file.originalname,
    storedName: file.filename,
    path: file.path,
    size: file.size,
    mimeType: file.mimetype,
  });

  let resumeId = null;
  try {
    resumeId = await insertResumeFile(collections, resumeDoc);
  } catch (error) {
    console.error('Failed to save resume metadata:', error);
  }

  let fitScore = 'Pending';
  let scoreBreakdown = null;
  let scoreTitle = 'Resume Strength & Role Fit';
  let positives = [];
  let negatives = [];
  let summary = '';

  if (!process.env.OPENAI_API_KEY) {
    negatives.push('OPENAI_API_KEY missing; cannot generate LLM score.');
  } else {
    try {
      const scoringClient = getScoringClient();
      const resumeText = await readResumeText(resumeDoc.path);
      const { summary: webSummary } = webSearchEnabled
        ? await runWebResearch({
            client: scoringClient,
            company,
            role: inferRoleFromJobDescription(jobDescription),
          })
        : { summary: '' };
      const assessment = await getFitAssessment({
        resumeText,
        jobDescription: jobDescForLLM,
        company,
        webResearch: webSummary || '',
      });

      if (assessment) {
        fitScore = assessment.compatibility_score ?? fitScore;
        scoreBreakdown = assessment.breakdown || scoreBreakdown;
        scoreTitle = assessment.title || scoreTitle;
        positives = assessment.positives || positives;
        negatives = assessment.negatives || negatives;
        summary = assessment.summary || summary;
      }
    } catch (error) {
      console.error('LLM fit assessment failed:', error);
      negatives.push('LLM scoring unavailable; please retry.');
    }
  }

  try {
    if (resumeId && collections?.resumeScores) {
      const scoreDoc = buildResumeScore({
        userId: userObjectId,
        resumeId,
        score: fitScore,
        rubric: scoreBreakdown,
        title: scoreTitle,
        summary,
        positives,
        negatives,
        company,
        jobSnippet: jobDescForDisplay,
      });
      await insertResumeScore(collections, scoreDoc);
    }
  } catch (error) {
    console.warn('Failed to persist fit score:', error.message);
  }

  return {
    fitScore,
    positives,
    negatives,
    summary,
    company,
    jobSnippet: jobDescForDisplay,
    resumeName: resumeDoc.originalName,
    resumeSizeKb: Math.max(1, Math.round(resumeDoc.size / 1024)),
    resumeId,
    scoreBreakdown,
    scoreTitle,
  };
};

module.exports = {
  clamp01,
  isEnabledField,
  readResumeText,
  createResumeAssessment,
};
