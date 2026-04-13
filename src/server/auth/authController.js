/**
 * Authentication controller.
 * Inputs: Express req/res objects, form data in req.body, sessions, and app-local collections.
 * Outputs: Renders auth views, updates session state, and redirects after auth actions.
 */
const { signupUser, loginUser } = require('./authService');

const saveSession = (req) =>
  new Promise((resolve, reject) => {
    req.session.save((error) => {
      if (error) return reject(error);
      resolve();
    });
  });

const showLogin = (req, res) => {
  res.render('login', { error: null });
};

const showSignup = (req, res) => {
  res.render('signup', { error: null });
};

const signup = async (req, res) => {
  try {
    req.session.user = await signupUser(req.app.locals.collections, req.body || {});
    await saveSession(req);
    res.redirect('/');
  } catch (error) {
    console.error('Signup failed:', error);
    res.status(error.status || 500).render('signup', {
      error: error.status ? error.message : 'Signup failed. Try again.',
    });
  }
};

const login = async (req, res) => {
  try {
    req.session.user = await loginUser(req.app.locals.collections, req.body || {});
    await saveSession(req);
    res.redirect('/');
  } catch (error) {
    console.error('Login failed:', error);
    res.status(error.status || 500).render('login', {
      error: error.status ? error.message : 'Login failed. Try again.',
    });
  }
};

const logout = (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
};

module.exports = { showLogin, showSignup, signup, login, logout };
