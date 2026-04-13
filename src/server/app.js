/**
 * Express application assembly module.
 * Inputs: Environment variables, route modules, session store configuration, and static asset paths.
 * Outputs: A configured Express app with middleware, auth guard, and mounted routes.
 */
const express = require('express');
const path = require('path');
const fs = require('fs');
const session = require('express-session');
const { MongoSessionStore } = require('./shared/mongoSessionStore');
const { getMongoConfig } = require('./shared/databaseConfig');
const app = express();

const uploadRouter = require('./routes/upload');
const homeRouter = require('./routes/home');
const resultsRouter = require('./routes/results');
const openaiRouter = require('./routes/openai');
const authRouter = require('./routes/auth');
const profileRouter = require('./routes/profile');
const resumesRouter = require('./routes/resumes');
const adminRouter = require('./routes/admin');
const uploadsDir = path.join(__dirname, '..', '..', 'uploads');
const isProduction = process.env.NODE_ENV === 'production';
const sessionSecret = process.env.SESSION_SECRET || 'dev-only-insecure-session-secret';
const mongoConfig = getMongoConfig();
const sessionStore = new MongoSessionStore({
  uri: mongoConfig.uri,
  dbName: mongoConfig.dbName,
  collectionName: process.env.SESSION_COLLECTION || 'sessions',
});

// creates the uploads folder if it doesn't exist for the user yet
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

if (isProduction && !process.env.SESSION_SECRET) {
  throw new Error('SESSION_SECRET must be set before starting the app in production.');
}

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '..', 'views'));

if (isProduction) {
  app.set('trust proxy', 1);
}

app.locals.sessionStore = sessionStore;

app.use(express.static(path.join(__dirname, '..', 'public')));
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
  store: sessionStore,
  resave: false,
  saveUninitialized: false,
  proxy: isProduction,
  unset: 'destroy',
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProduction ? 'auto' : false,
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

const requireAdmin = (req, res, next) => {
  if (req.session?.user?.role === 'admin') return next();
  return res.status(403).render('error', {
    title: 'Admin Access Required',
    message: 'This page is only available to admin accounts.',
  });
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
app.use('/admin', requireAuth, requireAdmin, adminRouter);

module.exports = app;
