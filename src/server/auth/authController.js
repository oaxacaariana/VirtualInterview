/**
 * Authentication controller.
 * Inputs: Express req/res objects, form data in req.body, sessions, and app-local collections.
 * Outputs: Renders auth views, updates session state, and redirects after auth actions.
 */
const { signupUser, loginUser, requestTemporaryPassword } = require('./authService');

const saveSession = (req) =>
  new Promise((resolve, reject) => {
    req.session.save((error) => {
      if (error) return reject(error);
      resolve();
    });
  });

const establishSession = (req, user, mustChangePassword = false) =>
  new Promise((resolve, reject) => {
    req.session.regenerate((error) => {
      if (error) {
        reject(error);
        return;
      }

      req.session.user = user;
      req.session.mustChangePassword = mustChangePassword;

      req.session.save((saveError) => {
        if (saveError) {
          reject(saveError);
          return;
        }
        resolve();
      });
    });
  });

const showLogin = (req, res) => {
  res.render('login', { error: null });
};

const showForgotPassword = (req, res) => {
  res.render('forgot-password', {
    error: null,
    temporaryPassword: null,
    username: '',
  });
};

const showSignup = (req, res) => {
  res.render('signup', { error: null });
};

const signup = async (req, res) => {
  try {
    const user = await signupUser(req.app.locals.collections, req.body || {});
    await establishSession(req, user, false);
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
    const { user, usedTemporaryPassword } = await loginUser(
      req.app.locals.collections,
      req.body || {}
    );
    await establishSession(req, user, usedTemporaryPassword);
    res.redirect('/');
  } catch (error) {
    console.error('Login failed:', error);
    res.status(error.status || 500).render('login', {
      error: error.status ? error.message : 'Login failed. Try again.',
    });
  }
};

const forgotPassword = async (req, res) => {
  try {
    const { username, temporaryPassword } = await requestTemporaryPassword(
      req.app.locals.collections,
      req.body || {}
    );

    res.render('forgot-password', {
      error: null,
      temporaryPassword,
      username,
    });
  } catch (error) {
    console.error('Forgot password failed:', error);
    res.status(error.status || 500).render('forgot-password', {
      error: error.status ? error.message : 'Could not generate a temporary password.',
      temporaryPassword: null,
      username: req.body?.username || '',
    });
  }
};

const logout = (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('virtual_interview.sid');
    res.redirect('/');
  });
};

module.exports = {
  showLogin,
  showForgotPassword,
  showSignup,
  signup,
  login,
  forgotPassword,
  logout,
};
