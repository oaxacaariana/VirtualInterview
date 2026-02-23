require('dotenv').config();
const express = require('express');
const multer = require('multer');
const app = express();
const fs = require('fs');
const PORT = process.env.PORT || 3000;

// Initialize local file system
const storage = multer.diskStorage({
  destination: (req, file, cb) => { // Where the file is saved
    cb(null, 'uploads/'); // Saves uploaded files to the uploads folder
  },
  filename: (req, file, cb) => { // What the file is named
    cb(null, file.originalname + '-' + Date.now()); // Sets file name to "name-time" so its unique
  },
});
const upload = multer({ storage });

if (!fs.existsSync('uploads')) { // Checks that uploads folder exists
  fs.mkdirSync('uploads');
}

app.set('view engine', 'ejs');

app.get('/', (req, res) => { // Sets home.ejs as default page 
  res.render('home');
});

// Route for file upload
app.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).send("No file uploaded");
  }
  res.status(200).send("File uploaded successfully");
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});