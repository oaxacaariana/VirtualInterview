const express = require('express');
const path = require('path');
const fs = require('fs');
const session = require('express-session');
const app = express();

const uploadRouter = require('./routes/upload');
const homeRouter = require('./routes/home');
const resultsRouter = require('./routes/results');
const openaiRouter = require('./routes/openai');
const authRouter = require('./routes/auth');
const profileRouter = require('./routes/profile');

// creates the uploads folder if it doesn't exist for the user yet
if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads');
}

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'changeme-session-secret',
  resave: false,
  saveUninitialized: false,
}));

// simple auth guard
const requireAuth = (req, res, next) => {
  if (req.session?.user) return next();
  return res.redirect('/login');
};

app.use((req, res, next) => {
  res.locals.currentUser = req.session?.user || null;
  res.locals.activePath = req.path.split('?')[0];
  next();
});

app.use('/', homeRouter);
app.use('/', authRouter);
app.use('/openai', requireAuth, openaiRouter);
app.use('/upload', requireAuth, uploadRouter);
app.use('/results', requireAuth, resultsRouter);
app.use('/profile', requireAuth, profileRouter);

module.exports = app;

console.log('Static files path:', path.join(__dirname, 'public'));
