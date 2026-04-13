/**
 * Profile controller.
 * Inputs: Express req/res objects, session user state, profile form values, and collections.
 * Outputs: Renders the profile page and persists profile updates when submitted.
 */
const bcrypt = require('bcryptjs');
const { findUserById, updateUserById } = require('./userRepository');
const { toSessionUser } = require('./authService');
const { getResumeCollectionView } = require('../resumes/resumeService');

const saveSession = (req) =>
  new Promise((resolve, reject) => {
    req.session.save((error) => {
      if (error) return reject(error);
      resolve();
    });
  });

const renderProfile = async (req, res, { error = null, success = null } = {}) => {
  const user = await findUserById(req.app.locals.collections, req.session?.user?.id);
  const resumes = await getResumeCollectionView({
    collections: req.app.locals.collections,
    sessionUser: req.session?.user,
    archived: false,
    limit: 20,
  });

  if (user && req.session?.user) {
    req.session.user.name = user.name;
    req.session.user.role = user.role || 'candidate';
  }

  res.render('profile', {
    user,
    resumes,
    error,
    success,
  });
};

const showProfile = async (req, res) => {
  if (!req.session?.user?.id) {
    return res.redirect('/login');
  }

  return renderProfile(req, res);
};

const updateProfile = async (req, res) => {
  if (!req.session?.user?.id) {
    return res.redirect('/login');
  }

  const { name, password } = req.body || {};
  const updates = {};

  if (name) updates.name = name;
  if (password) {
    updates.passwordHash = await bcrypt.hash(password, 10);
  }

  if (Object.keys(updates).length === 0) {
    return renderProfile(req, res, { error: 'No changes submitted.' });
  }

  try {
    const updatedUser = await updateUserById(
      req.app.locals.collections,
      req.session.user.id,
      updates
    );

    req.session.user = toSessionUser(updatedUser);
    await saveSession(req);

    return renderProfile(req, res, { success: 'Profile updated.' });
  } catch (error) {
    console.error('Profile update failed:', error);
    return renderProfile(req, res, { error: 'Profile update failed.' });
  }
};

module.exports = { showProfile, updateProfile };
