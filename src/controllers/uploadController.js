const fs = require('fs');
const OpenAI = require('openai');
const { ObjectId } = require('mongodb');
const { buildResumeFile } = require('../db/persistence');

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const model = process.env.MODEL || 'gpt-4.1-mini';

const showUploadPage = (req, res) => {
  res.render('upload'); 
};

const readResumeText = (filePath) => {
  try {
    const raw = fs.readFileSync(filePath);
    return raw.toString('utf8').slice(0, 8000);
  } catch (error) {
    console.error('Unable to read resume file:', error);
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
    userId: null, // TODO: attach authenticated user id when auth is added
    originalName: req.file.originalname,
    storedName: req.file.filename,
    path: req.file.path,
    size: req.file.size,
    mimeType: req.file.mimetype,
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
      const resumeText = readResumeText(resumeDoc.path);
      const assessment = await getFitAssessment({ resumeText, jobDescription, company });
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

  res.render('results', {
    fitScore,
    positives,
    negatives,
    summary,
    company,
    jobSnippet: jobDescription.slice(0, 700),
    resumeName: resumeDoc.originalName,
    resumeSizeKb: Math.max(1, Math.round(resumeDoc.size / 1024)),
    resumeId,
  });
};

module.exports = { showUploadPage, handleUpload };
 
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
    const raw = fs.readFileSync(doc.path);
    res.type('text/plain').send(raw.toString('utf8'));
  } catch (error) {
    console.error('Failed to read resume file:', error);
    res.status(500).send('Could not read stored resume file.');
  }
};

module.exports = { showUploadPage, handleUpload, viewResume };
