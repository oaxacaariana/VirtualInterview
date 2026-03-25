const express = require('express');
const multer = require('multer');
const path = require('path');
const router = express.Router();
const { handleUpload, showUploadPage, viewResume } = require('../controllers/uploadController');

// const upload = multer({ dest: "uploads/" }); 

const storage = multer.diskStorage({
  destination: (req, file, cb) => { // Where the file is saved
    cb(null, 'uploads/'); // Saves uploaded files to the uploads folder
  },
  filename: (req, file, cb) => { // What the file is named
    // Properly separate filename from extension to preserve extension for parser
    const ext = path.extname(file.originalname);
    const name = path.basename(file.originalname, ext);
    cb(null, name + '-' + Date.now() + ext); // Sets file name to "name-time.ext" so its unique
  },
});

const upload = multer({ storage });
router.get('/', showUploadPage); 
router.post('/', upload.single('resume'), handleUpload);
router.get('/preview/:id', viewResume);

module.exports = router;
