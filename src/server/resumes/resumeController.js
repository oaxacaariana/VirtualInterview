/**
 * Resume controller.
 * Inputs: Express req/res objects, uploaded files, query/body values, sessions, and collections.
 * Outputs: Renders resume upload/list/results views and processes archive/preview actions.
 */
const {
  getResumeCollectionView,
  getResumeResultsView,
  getUploadResultView,
  getResumePreviewData,
} = require('./resumeService');
const { updateResumeArchiveState } = require('./resumeRepository');

const showUploadPage = (req, res) => {
  res.render('upload');
};

const handleUpload = async (req, res) => {
  const viewModel = await getUploadResultView({
    collections: req.app.locals.collections,
    sessionUser: req.session?.user,
    file: req.file,
    body: req.body,
  });

  res.render('results', viewModel);
};

const showResumes = async (req, res) => {
  const showArchived = req.query?.archived === '1';
  const resumes = await getResumeCollectionView({
    collections: req.app.locals.collections,
    sessionUser: req.session?.user,
    archived: showArchived,
    limit: 50,
  });

  res.render('resumes', {
    user: null,
    resumes,
    error: null,
    showArchived,
  });
};

const showResultsPage = async (req, res) => {
  const viewModel = await getResumeResultsView({
    collections: req.app.locals.collections,
    sessionUser: req.session?.user,
    resumeId: req.query?.resumeId,
  });

  res.render('results', viewModel);
};

const archiveResume = async (req, res) => {
  await updateResumeArchiveState(
    req.app.locals.collections,
    req.session?.user,
    req.params.id,
    true
  );
  res.redirect(req.get('referer') || '/resumes');
};

const unarchiveResume = async (req, res) => {
  await updateResumeArchiveState(
    req.app.locals.collections,
    req.session?.user,
    req.params.id,
    false
  );
  res.redirect(req.get('referer') || '/resumes?archived=1');
};

const viewResume = async (req, res) => {
  try {
    const data = await getResumePreviewData({
      collections: req.app.locals.collections,
      sessionUser: req.session?.user,
      resumeId: req.params.id,
    });

    if (!data) {
      return res.status(404).send('Resume not found.');
    }

    const { resume, parsedText } = data;
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
            <div><strong>Original Name:</strong> ${resume.originalName || 'n/a'}</div>
            <div><strong>MIME Type:</strong> ${resume.mimeType || 'n/a'}</div>
            <div><strong>Size:</strong> ${resume.size ? Math.round(resume.size / 1024) + ' KB' : 'n/a'}</div>
            <div><strong>Stored Path:</strong> ${resume.path || 'n/a'}</div>
            <div class="muted">Note: Files are stored on disk; Mongo holds metadata and parsed scoring output.</div>
          </div>
          <h3>Extracted Text (best-effort)</h3>
          <pre>${parsedText || 'No text extracted from resume.'}</pre>
        </div>
      </body>
      </html>
    `;

    return res.type('text/html').send(html);
  } catch (error) {
    console.error('Failed to read/parse resume file:', error);
    return res.status(500).send('Could not read stored resume file.');
  }
};

module.exports = {
  showUploadPage,
  handleUpload,
  showResumes,
  showResultsPage,
  archiveResume,
  unarchiveResume,
  viewResume,
};
