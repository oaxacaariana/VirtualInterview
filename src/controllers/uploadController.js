const fs = require('fs');
const OpenAI = require('openai');
const { ObjectId } = require('mongodb');
const { buildResumeFile, buildResumeScore } = require('../db/persistence');
const { parseResumeToText } = require('../utils/resumeParser');

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const model = process.env.MODEL || 'gpt-4.1-mini';

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

const getFitAssessment = async ({ resumeText, jobDescription, company }) => {
  const completion = await client.chat.completions.create({
    model,
    temperature: 0.4,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content:
          `You are a hiring manager at ${company || 'the target company'}. ` +
          'Review the candidate resume and job description. Return strict JSON with keys: ' +
          'fit_score (0-100 number), positives (array of strings), negatives (array of strings), summary (2-3 sentences referencing resume specifics). ' +
          'Base the assessment only on the provided resume and job description.' +
          'If information is missing, note that in the negatives. Be concise and specific.' +
          'Example response: {"fit_score": 85, "positives": ["Strong experience with JavaScript and React.", "Led a team of 5 engineers."], "negatives": ["Job description mentions Python, which is not in the resume.", "Resume does not specify years of experience."], "summary": "The candidate has strong frontend experience relevant to the role, but lacks Python skills mentioned in the job description. Clarification on years of experience would be helpful."}' +
          'If the resume text is unreadable or missing, return fit_score of 0 and note the issue in negatives.'

      },
      {
        role: 'user',
        content: `Job description:\n${jobDescription || 'N/A'}\n\nResume:\n${resumeText || 'Resume text unavailable.'}`,
      },
    ],
  });

  const content = completion.choices?.[0]?.message?.content;
  return content ? JSON.parse(content) : null;
};

const handleUpload = async (req, res) => {
  const { company = '', jobDescription = '' } = req.body || {};
  const jobDescForLLM = jobDescription.slice(0, 4000); // allow longer input for scoring
  const jobDescForDisplay = jobDescription.slice(0, 700); // keep display concise
  const userObjectId = req.session?.user?.id ? new ObjectId(req.session.user.id) : null;

  const ringColorForScore = (score) => {
    if (typeof score !== 'number') return '#555';
    if (score <= 20) return '#d64545';
    if (score <= 50) return '#f0a202';
    if (score <= 75) return '#8ac12f';
    return '#3fc26c';
  };

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
  let positives = [];
  let negatives = [];
  let summary = '';

  if (!process.env.OPENAI_API_KEY) {
    negatives.push('OPENAI_API_KEY missing; cannot generate LLM score.');
  } else {
    try {
      const resumeText = await readResumeText(resumeDoc.path);
      const assessment = await getFitAssessment({ resumeText, jobDescription: jobDescForLLM, company });
      if (assessment) {
        fitScore = assessment.fit_score ?? fitScore;
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
  });
};

// Debug helper: view stored resume text by resumeId
const viewResume = async (req, res) => {
  const { id } = req.params;
  const collection = req.app.locals.collections?.resumeFiles;

  if (!collection) {
    return res.status(500).send('resumeFiles collection not available');
  }

  let doc;
  try {
    doc = await collection.findOne({ _id: new ObjectId(id) });
  } catch (error) {
    console.error('Invalid resume id:', error);
    return res.status(400).send('Invalid resume id.');
  }

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
