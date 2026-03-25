const bcrypt = require('bcryptjs');
const { buildUser } = require('../db/persistence');

const showLogin = (req, res) => {
  res.render('login', { error: null });
};

const showSignup = (req, res) => {
  res.render('signup', { error: null });
};

const signup = async (req, res) => {
  const { username, name, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).render('signup', { error: 'Username and password are required.' });
  }

  try {
    const users = req.app.locals.collections?.users;
    if (!users) {
      return res.status(500).render('signup', { error: 'User store unavailable.' });
    }

    const existing = await users.findOne({ username: username.toLowerCase() });
    if (existing) {
      return res.status(400).render('signup', { error: 'Username already taken.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const userDoc = buildUser({ username, name: name || username, passwordHash });
    const { insertedId } = await users.insertOne(userDoc);

    req.session.user = { id: insertedId, username: userDoc.username, name: userDoc.name };
    res.redirect('/');
  } catch (error) {
    console.error('Signup failed:', error);
    res.status(500).render('signup', { error: 'Signup failed. Try again.' });
  }
};

const login = async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).render('login', { error: 'Username and password are required.' });
  }

  try {
    const users = req.app.locals.collections?.users;
    if (!users) {
      return res.status(500).render('login', { error: 'User store unavailable.' });
    }

    const user = await users.findOne({ username: username.toLowerCase() });
    if (!user) {
      return res.status(400).render('login', { error: 'Invalid credentials.' });
    }

    const ok = await bcrypt.compare(password, user.passwordHash || '');
    if (!ok) {
      return res.status(400).render('login', { error: 'Invalid credentials.' });
    }

    req.session.user = { id: user._id, username: user.username, name: user.name };
    res.redirect('/');
  } catch (error) {
    console.error('Login failed:', error);
    res.status(500).render('login', { error: 'Login failed. Try again.' });
  }
};

const logout = (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
};

module.exports = { showLogin, showSignup, signup, login, logout };
