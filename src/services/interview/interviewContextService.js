const { parseResumeToText } = require('../../utils/resumeParser');
const { runWebResearch } = require('../../utils/webResearch');
const { findOwnedResumeById } = require('../../repositories/resumeRepository');
const { buildBackgroundDoc } = require('./interviewPromptBuilder');
const { interviewModel } = require('../../lib/openaiClient');

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
          content:
            'You are preparing a fast research note for an interviewer. Summarize in <=120 words, comma-separated phrases only: top role requirements, common/previous interview question themes for this company/role (if unknown, use industry-standard for that role), notable company focus areas, web-retrieved signals (if any), and 4-6 sharp resume signals (skills, impacts, industries). Keep terse and scannable.',
        },
        {
          role: 'user',
          content: `Company: ${company}\nRole: ${role}\nWeb signals: ${webSignals || 'none'}\nResume (truncated): ${resumeText.slice(0, 2000)}`,
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

const loadInterviewContext = async ({ collections, sessionUser, openaiClient, resumeId, company, role }) => {
  const resumeDoc = await findOwnedResumeById(collections, sessionUser, resumeId, { activeOnly: true });
  if (!resumeDoc) {
    const error = new Error('Resume not found.');
    error.status = 404;
    throw error;
  }

  let resumeText = '';
  if (resumeDoc.path) {
    resumeText = (await parseResumeToText(resumeDoc.path)).slice(0, 8000);
  }

  const webSignals = await fetchWebResearch({ company, role, openaiClient });
  const researchSummary = await generateBackgroundNote({
    openaiClient,
    resumeText,
    company,
    role,
    webSignals,
  });

  return {
    resumeDoc,
    resumeText,
    webSignals,
    researchSummary,
    backgroundDoc: buildBackgroundDoc({
      resumeText,
      company,
      role,
      researchSummary,
    }),
  };
};

module.exports = {
  loadInterviewContext,
};
