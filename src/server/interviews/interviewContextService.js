/**
 * Interview context service.
 * Inputs: Collections, selected resume id, session user state, company/role context, and OpenAI client.
 * Outputs: Cached interview context including resume text, research summary, and background document text.
 */
const { parseResumeToText } = require('../shared/resumeParser');
const { runWebResearch } = require('../shared/webResearch');
const { findOwnedResumeById } = require('../resumes/resumeRepository');
const { buildBackgroundDoc } = require('./interviewPromptBuilder');
const { interviewModel } = require('../shared/openaiClient');

const fetchWebResearch = async ({ company, role, openaiClient }) => {
  const { summary } = await runWebResearch({ client: openaiClient, company, role });
  return summary;
};

const generateBackgroundNote = async ({ openaiClient, resumeText, company, role, webSignals }) => {
  try {
    const completion = await openaiClient.chat.completions.create({
      model: interviewModel,
      temperature: 0.4,
      messages: [
      {
        role: 'system',
        content: 'You are preparing a fast research note for an interviewer. Summarize in <=120 words, comma-separated phrases only: top role requirements, common/previous interview question themes for this company/role (if unknown, use industry-standard for that role), notable company focus areas, web-retrieved signals (if any), and 4-6 sharp resume signals (skills, impacts, industries). Keep terse and scannable.',
      },
      {
        role: 'user',
        content: `Company: ${company},\nRole: ${role},\nWeb signals: ${webSignals || 'none'},\nResume (truncated): ${resumeText.slice(0, 2000)}`,
      },
      ],
      max_tokens: 200,
    });
    return completion.choices?.[0]?.message?.content?.trim() || '';
  } catch (err) {
    console.warn('Background note generation failed:', err.message);
    return '';
  }
};

const buildCachedInterviewContext = ({
  resumeDoc,
  resumeText,
  webSignals,
  researchSummary,
  jobDescription,
  company,
  role,
}) => ({
  resumeDoc,
  resumeText,
  webSignals,
  researchSummary,
  jobDescription,
  backgroundDoc: buildBackgroundDoc({
    resumeText,
    company,
    role,
    researchSummary,
    jobDescription,
  }),
});

const loadInterviewContext = async ({
  collections,
  sessionUser,
  openaiClient,
  resumeId,
  company,
  role,
  activeOnly = true,
  includeResearch = true,
  webSearchEnabled = true,
}) => {
  const resumeDoc = await findOwnedResumeById(collections, sessionUser, resumeId, { activeOnly });
  if (!resumeDoc) {
    const error = new Error('Resume not found.');
    error.status = 404;
    throw error;
  }

  let resumeText = '';
  if (resumeDoc.path) {
    resumeText = (await parseResumeToText(resumeDoc.path)).slice(0, 8000);
  }

  let webSignals = '';
  let researchSummary = '';
  if (includeResearch && webSearchEnabled) {
    webSignals = await fetchWebResearch({ company, role, openaiClient });
    researchSummary = await generateBackgroundNote({
      openaiClient,
      resumeText,
      company,
      role,
      webSignals,
    });
  }

  let latestResumeScore = null;
  if (collections?.resumeScores) {
    latestResumeScore = await collections.resumeScores
      .find({ resumeId: resumeDoc._id })
      .sort({ createdAt: -1 })
      .limit(1)
      .next();
  }

  return buildCachedInterviewContext({
    resumeDoc,
    resumeText,
    webSignals,
    researchSummary,
    jobDescription: latestResumeScore?.jobSnippet || '',
    company,
    role,
  });
};

module.exports = {
  buildCachedInterviewContext,
  loadInterviewContext,
};
