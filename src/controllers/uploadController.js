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

const applyQualityCaps = (score, breakdown) => {
  const capped = Number(score) || 0;

  // Do not allow obviously thin resumes to pass as strong matches just because keywords line up.
  if (
    breakdown.resume_completeness <= 4 ||
    breakdown.professional_structure_clarity <= 4 ||
    breakdown.experience_depth <= 8
  ) {
    return Math.min(capped, 59);
  }

  if (
    breakdown.resume_completeness <= 6 ||
    breakdown.professional_structure_clarity <= 6 ||
    breakdown.skills_evidence_alignment <= 5 ||
    breakdown.project_quality <= 2
  ) {
    return Math.min(capped, 69);
  }

  return capped;
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
          'Evaluate both role fit and resume quality with a strict standard.',
          "Compare the candidate's skills, experience, education, project depth, and written evidence against the job description and inferred company expectations.",
          'Do not reward a resume just because it contains relevant keywords.',
          'A sparse, skeletal, or underdeveloped resume must be penalized even if the candidate seems qualified on paper.',
          'Return JSON only (no prose) with keys and ranges:',
          'title, role_fit (0-25), experience_depth (0-20), quantified_impact (0-15), skills_evidence_alignment (0-10), resume_completeness (0-10), professional_structure_clarity (0-10), project_quality (0-5), education_certifications (0-5), compatibility_score (0-100), positives (array of strengths), negatives (array of risks/gaps), summary (2-4 concise sentences).',
          'For education_certifications: grant full points when the job description states "no degree required", "degree optional", or prefers experience over formal education, unless the resume explicitly conflicts (e.g., lacks a required certification that IS specified). Do not penalize missing degrees when the posting says it is not required.',
          'If skills are listed but not demonstrated through experience or projects, reduce skills_evidence_alignment.',
          'If projects are vague, tiny, or missing technical detail, scale, tooling, architecture, or outcomes, reduce project_quality.',
          'If experience bullets are short, generic, or lacking measurable impact, reduce experience_depth and quantified_impact.',
          'If the resume is missing common professional detail that would improve credibility, reduce resume_completeness and professional_structure_clarity.',
          'A bare-bones resume with only one-line roles, shallow project blurbs, missing education, weak tooling evidence, or vague claims should score poorly even if the technology names match the job.',
          'Strong resumes must show verifiable expertise through implementation detail, scope, ownership, technical decisions, tools, architecture, and outcomes.',
          'Do not treat claims like "worked on scalable systems", "improved reliability", or "built APIs" as strong evidence unless the resume explains how, with what stack, at what scale, and with what result.',
          'Missing sections such as education, links, location, or fuller experience detail should count against completeness when they would normally be expected for a mid-level software engineer.',
          'If the resume reads like notes or an outline instead of a polished professional document, score structure and completeness harshly.',
          'A thin resume cannot receive an excellent overall score.',
          'A resume that feels unfinished, vague, or underexplained should not pass as a strong hire recommendation.',
          'Score only what is explicitly written. Do not infer missing quality from candidate potential.',
          'compatibility_score must equal the sum of the eight components, capped at 100. Make sure math is correct.',
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
    role_fit: clampScore(parsed.role_fit, 25),
    experience_depth: clampScore(parsed.experience_depth, 20),
    quantified_impact: clampScore(parsed.quantified_impact, 15),
    skills_evidence_alignment: clampScore(parsed.skills_evidence_alignment, 10),
    resume_completeness: clampScore(parsed.resume_completeness, 10),
    professional_structure_clarity: clampScore(parsed.professional_structure_clarity, 10),
    project_quality: clampScore(parsed.project_quality, 5),
    education_certifications: clampScore(parsed.education_certifications, 5),
  };

  const computedTotal = Object.values(breakdown).reduce((sum, val) => sum + val, 0);
  const compatibility_score = applyQualityCaps(Math.min(100, computedTotal), breakdown);
  const title = (parsed.title || 'Resume Strength & Role Fit').toString().trim() || 'Resume Strength & Role Fit';

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
      scoreTitle: 'Resume Strength & Role Fit',
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
  let scoreTitle = 'Resume Strength & Role Fit';
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
