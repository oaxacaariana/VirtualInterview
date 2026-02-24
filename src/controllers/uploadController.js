const showUploadPage = (req, res) => {
  res.render('upload'); 
};

const handleUpload = (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded' });
  }
  res.json({ message: 'File uploaded successfully', file: req.file });
};

module.exports = { showUploadPage, handleUpload };