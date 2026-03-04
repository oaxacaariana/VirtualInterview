const { buildResumeFile } = require('../db/persistence');

const showUploadPage = (req, res) => {
  res.render('upload'); 
};

const handleUpload = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded' });
  }

  const resumeDoc = buildResumeFile({
    userId: null, // TODO: attach authenticated user id when auth is added
    originalName: req.file.originalname,
    storedName: req.file.filename,
    path: req.file.path,
    size: req.file.size,
    mimeType: req.file.mimetype,
  });

  try {
    const collection = req.app.locals.collections?.resumeFiles;
    if (collection) {
      const { insertedId } = await collection.insertOne(resumeDoc);
      return res.json({
        message: 'File uploaded successfully',
        resumeId: insertedId,
        file: req.file,
      });
    }

    // Fallback if DB not initialized
    res.json({
      message: 'File uploaded (metadata not saved; DB unavailable)',
      file: req.file,
    });
  } catch (error) {
    console.error('Failed to save resume metadata:', error);
    res.status(500).json({ message: 'Upload saved, but metadata failed to store.' });
  }
};

module.exports = { showUploadPage, handleUpload };
