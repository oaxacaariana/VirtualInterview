const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();

const uploadRouter = require('./routes/upload');
const homeRouter = require('./routes/home');
const resultsRouter = require('./routes/results');
const historyRouter = require('./routes/history');

// creates the uploads folder if it doesn't exist for the user yet
if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads');
}

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());
app.use('/', homeRouter);
app.use('/upload', uploadRouter);
app.use('/results', resultsRouter);
app.use('/history', historyRouter);

module.exports = app;

console.log('Static files path:', path.join(__dirname, 'public'));
