/**
 * Resume view service.
 * Inputs: Collections, session user state, resume identifiers, upload payloads, and parsed resume data.
 * Outputs: View-model objects for upload results, resume lists, results pages, and previews.
 */
const { ringColorForScore } = require('../shared/scoreColors');
const { parseResumeToText } = require('../shared/resumeParser');
const {
  findOwnedResumeWithLatestScore,
  listResumesWithLatestScores,
} = require('./resumeRepository');
const { createResumeAssessment, isEnabledField } = require('./resumeScoringService');

const emptyResultsView = () => ({
  fitScore: null,
  ringColor: '#555',
  scoreBreakdown: null,
  scoreTitle: 'Resume Strength & Role Fit',
  positives: [],
  negatives: [],
  summary: '',
  company: '',
  jobSnippet: '',
  resumeName: 'Not provided',
  resumeSizeKb: null,
  resumeId: null,
});

const mapResumeSummary = (resumeDoc) => ({
  _id: resumeDoc._id,
  originalName: resumeDoc.originalName,
  archived: !!resumeDoc.archived,
  uploadedAt: resumeDoc.uploadedAt,
  fitScore: resumeDoc.fitScore ?? null,
  fitSummary: resumeDoc.fitSummary || '',
  fitPositives: resumeDoc.fitPositives || [],
  fitNegatives: resumeDoc.fitNegatives || [],
  fitCompany: resumeDoc.fitCompany || '',
  fitJobSnippet: resumeDoc.fitJobSnippet || '',
  fitTitle: resumeDoc.fitTitle || 'Resume Strength & Role Fit',
  fitRubric: resumeDoc.fitRubric || null,
  fitCreatedAt: resumeDoc.fitCreatedAt || null,
  ringColor: resumeDoc.ringColor ?? ringColorForScore(resumeDoc.fitScore),
});

const getResumeCollectionView = async ({
  collections,
  sessionUser,
  archived = false,
  limit = 50,
}) => {
  const resumes = await listResumesWithLatestScores(collections, sessionUser, { archived, limit });
  return resumes.map(mapResumeSummary);
};

const getResumeResultsView = async ({ collections, sessionUser, resumeId }) => {
  const resume = await findOwnedResumeWithLatestScore(collections, sessionUser, resumeId);
  if (!resume) {
    return emptyResultsView();
  }

  return {
    fitScore: resume.fitScore,
    ringColor: ringColorForScore(resume.fitScore),
    scoreBreakdown: resume.fitRubric || null,
    scoreTitle: resume.fitTitle || 'Resume Strength & Role Fit',
    positives: resume.fitPositives || [],
    negatives: resume.fitNegatives || [],
    summary: resume.fitSummary || '',
    company: resume.fitCompany || '',
    jobSnippet: resume.fitJobSnippet || '',
    resumeName: resume.originalName || 'Not provided',
    resumeSizeKb: resume.size ? Math.round(resume.size / 1024) : null,
    resumeId: resume._id.toString(),
  };
};

const getUploadResultView = async ({ collections, sessionUser, file, body }) => {
  if (!file) {
    return {
      fitScore: 'Pending',
      ringColor: ringColorForScore(null),
      positives: [],
      negatives: ['No resume uploaded. Please try again.'],
      summary: '',
      company: body?.company || '',
      jobSnippet: body?.jobDescription || '',
      resumeName: 'Not provided',
      resumeSizeKb: null,
      resumeId: null,
      scoreBreakdown: null,
      scoreTitle: 'Resume Strength & Role Fit',
    };
  }

  const result = await createResumeAssessment({
    collections,
    sessionUser,
    file,
    company: body?.company || '',
    jobDescription: body?.jobDescription || '',
    webSearchEnabled: isEnabledField(body?.webSearchEnabled, true),
  });

  return {
    ...result,
    ringColor: ringColorForScore(result.fitScore),
  };
};

const getResumePreviewData = async ({ collections, sessionUser, resumeId }) => {
  const resume = await findOwnedResumeWithLatestScore(collections, sessionUser, resumeId);
  if (!resume) {
    return null;
  }

  const parsedText = await parseResumeToText(resume.path);
  return { resume, parsedText };
};

module.exports = {
  emptyResultsView,
  getResumeCollectionView,
  getResumeResultsView,
  getUploadResultView,
  getResumePreviewData,
};
