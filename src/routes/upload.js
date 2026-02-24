const express = require('express');
const multer = require('multer');
const router = express.Router();
const { handleUpload, showUploadPage } = require('../controllers/uploadController');

// const upload = multer({ dest: "uploads/" }); 

const storage = multer.diskStorage({
  destination: (req, file, cb) => { // Where the file is saved
    cb(null, 'uploads/'); // Saves uploaded files to the uploads folder
  },
  filename: (req, file, cb) => { // What the file is named
    cb(null, file.originalname + '-' + Date.now()); // Sets file name to "name-time" so its unique
  },
});

const upload = multer({ storage });
router.get('/', showUploadPage); 
router.post('/', upload.single('file'), handleUpload);

module.exports = router;
