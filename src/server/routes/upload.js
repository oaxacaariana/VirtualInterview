/**
 * Resume upload route module.
 * Inputs: Express router, Multer storage config, and resume controller handlers.
 * Outputs: Mounted routes for upload page rendering, file submission, and preview access.
 */
const express = require('express');
const multer = require('multer');
const path = require('path');
const router = express.Router();
const { handleUpload, showUploadPage, viewResume } = require('../resumes/resumeController');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = path.basename(file.originalname, ext);
    cb(null, name + '-' + Date.now() + ext);
  },
});

const upload = multer({ storage });
router.get('/', showUploadPage);
router.post('/', upload.single('resume'), handleUpload);
router.get('/preview/:id', viewResume);

module.exports = router;
