const OpenAI = require('openai');
const { ObjectId } = require('mongodb');
const { buildResumeFile, buildResumeScore } = require('../db/persistence');
const { parseResumeToText } = require('../utils/resumeParser');
const { runWebResearch } = require('../utils/webResearch');
const { ringColorForScore } = require('../utils/scoreColors');

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const model = process.env.MODEL || 'gpt-4.1-mini';

const toObjectId = (id) => {
  try {
    return typeof id === 'string' ? new ObjectId(id) : id;
  } catch {
    return null;
  }
};

const buildOwnedResumeFilter = (req, resumeId) => {
  const userId = toObjectId(req.session?.user?.id);
  if (!resumeId || !userId) return null;

  return {
    _id: resumeId,
    $or: [
      { userId },
      { userId: req.session?.user?.id || null },
    ],
  };
};

const showUploadPage = (req, res) => {
  res.render('upload'); 
};

// TODO: replace this stub with a real PDF/DOCX parser (e.g., pdf-parse / mammoth) and
// persist the parsed text into resumeFiles for preview + scoring.
const readResumeText = async (filePath) => {
  try {
    return (await parseResumeToText(filePath)).slice(0, 8000);
  } catch (error) {
    console.error('Unable to parse resume file:', error);
    return '';
  }
};

const inferRoleFromJobDescription = (desc) => {
  if (!desc) return '';
  const firstLine = desc.split(/\r?\n/).find((line) => line.trim().length > 0) || '';
  return firstLine.trim().slice(0, 120);
};

const clampScore = (value, max) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  return Math.min(Math.max(Math.round(num), 0), max);
};

const getFitAssessment = async ({ resumeText, jobDescription, company, webResearch }) => {
  const completion = await client.chat.completions.create({
    model,
    temperature: 0.4,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: [
          `You are a hiring manager at ${company || 'the target company'}.`,
          'Analyze how well the candidate fits the specific company and job.',
          "Compare the candidate's skills, experience, education, and achievements against the job description and inferred company expectations.",
          'Return JSON only (no prose) with keys and ranges:',
          'title, skills_alignment (0-30), experience_relevance (0-25), education_certifications (0-15), role_keywords (0-15), achievements_impact (0-15), compatibility_score (0-100), positives (array of strengths), negatives (array of risks/gaps), summary (2-3 concise sentences).',
          'For education_certifications: grant full points when the job description states "no degree required", "degree optional", or prefers experience over formal education, unless the resume explicitly conflicts (e.g., lacks a required certification that IS specified). Do not penalize missing degrees when the posting says it is not required.',
          'compatibility_score must equal the sum of the five components, capped at 100. Make sure math is correct.',
          'If resume or job description is missing/unreadable, set all numeric values to 0 and explain in negatives.',
          `Use these web research cues for context: ${webResearch || 'none available'}.`,
          'Do not add sentences, explanations, or extra keys outside the JSON.'
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
  } catch (err) {
    console.warn('Failed to parse assessment JSON:', err.message);
    return null;
  }

  const breakdown = {
    skills_alignment: clampScore(parsed.skills_alignment, 30),
    experience_relevance: clampScore(parsed.experience_relevance, 25),
    education_certifications: clampScore(parsed.education_certifications, 15),
    role_keywords: clampScore(parsed.role_keywords, 15),
    achievements_impact: clampScore(parsed.achievements_impact, 15),
  };

  const computedTotal = Object.values(breakdown).reduce((sum, val) => sum + val, 0);
  const compatibility_score = Math.min(100, computedTotal);
  const title = (parsed.title || 'Compatibility Score').toString().trim() || 'Compatibility Score';

  return {
    title,
    compatibility_score,
    breakdown,
    positives: Array.isArray(parsed.positives) ? parsed.positives.filter(Boolean) : [],
    negatives: Array.isArray(parsed.negatives) ? parsed.negatives.filter(Boolean) : [],
    summary: parsed.summary ? parsed.summary.toString().trim() : '',
  };
};

const handleUpload = async (req, res) => {
  const { company = '', jobDescription = '' } = req.body || {};
  const jobDescForLLM = jobDescription.slice(0, 4000); // allow longer input for scoring
  const jobDescForDisplay = jobDescription.slice(0, 700); // keep display concise
  const userObjectId = req.session?.user?.id ? new ObjectId(req.session.user.id) : null;
  const inferredRole = inferRoleFromJobDescription(jobDescription);

  if (!req.file) {
    return res.status(400).render('results', {
      fitScore: 'Pending',
      positives: [],
      negatives: ['No resume uploaded. Please try again.'],
      summary: '',
      company,
      jobSnippet: jobDescription,
      resumeName: 'Not provided',
      resumeSizeKb: null,
      resumeId: null,
      scoreBreakdown: null,
      scoreTitle: 'Compatibility Score',
      ringColor: ringColorForScore(null),
    });
  }

  const resumeDoc = buildResumeFile({
    userId: userObjectId,
    originalName: req.file.originalname,
    storedName: req.file.filename,
    path: req.file.path,
    size: req.file.size,
    mimeType: req.file.mimetype,
    // TODO: add parsedText field once resume parser is integrated
  });

  let resumeId = null;
  try {
    const collection = req.app.locals.collections?.resumeFiles;
    if (collection) {
      const { insertedId } = await collection.insertOne(resumeDoc);
      resumeId = insertedId;
    }
  } catch (error) {
    console.error('Failed to save resume metadata:', error);
  }

  let fitScore = 'Pending';
  let scoreBreakdown = null;
  let scoreTitle = 'Compatibility Score';
  let positives = [];
  let negatives = [];
  let summary = '';
  let webResearchSummary = '';

  if (!process.env.OPENAI_API_KEY) {
    negatives.push('OPENAI_API_KEY missing; cannot generate LLM score.');
  } else {
    try {
      const resumeText = await readResumeText(resumeDoc.path);
      const { summary: webSummary } = await runWebResearch({
        client,
        company,
        role: inferredRole,
      });
      webResearchSummary = webSummary || '';
      const assessment = await getFitAssessment({
        resumeText,
        jobDescription: jobDescForLLM,
        company,
        webResearch: webResearchSummary,
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

  // persist fit score to resumeScores collection
  try {
    if (resumeId && req.app.locals.collections?.resumeScores) {
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
      await req.app.locals.collections.resumeScores.insertOne(scoreDoc);
    }
  } catch (err) {
    console.warn('Failed to persist fit score:', err.message);
  }

  res.render('results', {
    fitScore,
    ringColor: ringColorForScore(fitScore),
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
  });
};

// Debug helper: view stored resume text by resumeId
const viewResume = async (req, res) => {
  const { id } = req.params;
  const collection = req.app.locals.collections?.resumeFiles;
  const resumeId = toObjectId(id);
  const resumeFilter = buildOwnedResumeFilter(req, resumeId);

  if (!collection) {
    return res.status(500).send('resumeFiles collection not available');
  }

  if (!resumeFilter) {
    return res.status(400).send('Invalid resume id.');
  }

  const doc = await collection.findOne(resumeFilter);

  if (!doc) {
    return res.status(404).send('Resume not found.');
  }

  try {
    const parsed = await parseResumeToText(doc.path);
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Resume Preview</title>
        <style>
          body { font-family: Arial, sans-serif; background: #0f0f10; color: #e5e5e5; padding: 24px; }
          .card { background: #181818; border: 1px solid #222; border-radius: 10px; padding: 16px; max-width: 900px; }
          pre { white-space: pre-wrap; background: #0f0f10; border: 1px solid #222; padding: 12px; border-radius: 8px; }
          .meta { margin-bottom: 14px; line-height: 1.5; }
          .muted { color: #aaa; }
        </style>
      </head>
      <body>
        <div class="card">
          <h1>Stored Resume Preview</h1>
          <div class="meta">
            <div><strong>Original Name:</strong> ${doc.originalName || 'n/a'}</div>
            <div><strong>MIME Type:</strong> ${doc.mimeType || 'n/a'}</div>
            <div><strong>Size:</strong> ${doc.size ? Math.round(doc.size / 1024) + ' KB' : 'n/a'}</div>
            <div><strong>Stored Path:</strong> ${doc.path || 'n/a'}</div>
            <div class="muted">Note: Files are stored on disk; Mongo holds metadata and (soon) parsed text.</div>
          </div>
          <h3>Extracted Text (best-effort)</h3>
          <pre>${parsed || 'No text extracted from resume (parser stub).'} </pre>
        </div>
      </body>
      </html>
    `;
    res.type('text/html').send(html);
  } catch (error) {
    console.error('Failed to read/parse resume file:', error);
    res.status(500).send('Could not read stored resume file.');
  }
};

module.exports = { showUploadPage, handleUpload, viewResume };
