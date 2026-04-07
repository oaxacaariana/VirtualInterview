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
const resumesRouter = require('./routes/resumes');
const calibrationRouter = require('./routes/calibration');
const uploadsDir = path.join(__dirname, '..', 'uploads');
const isProduction = process.env.NODE_ENV === 'production';
const sessionSecret = process.env.SESSION_SECRET || 'dev-only-insecure-session-secret';

// creates the uploads folder if it doesn't exist for the user yet
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

if (isProduction && !process.env.SESSION_SECRET) {
  throw new Error('SESSION_SECRET must be set before starting the app in production.');
}

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

if (isProduction) {
  app.set('trust proxy', 1);
}

app.use(express.static(path.join(__dirname, "public")));
app.use(
  '/uploads',
  express.static(uploadsDir, {
    maxAge: '30d',
    immutable: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  name: 'virtual_interview.sid',
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  proxy: isProduction,
  unset: 'destroy',
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProduction,
    maxAge: 1000 * 60 * 60 * 24 * 7,
  },
}));

// simple auth guard
const requireAuth = (req, res, next) => {
  if (req.session?.user) return next();
  const wantsJson = req.headers.accept && req.headers.accept.includes('application/json');
  if (wantsJson || req.xhr) {
    return res.status(401).json({ error: 'Authentication required. Please log in.' });
  }
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
app.use('/resumes', requireAuth, resumesRouter);
app.use('/calibration', requireAuth, calibrationRouter);

module.exports = app;

console.log('Static files path:', path.join(__dirname, 'public'));
