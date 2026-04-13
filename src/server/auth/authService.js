/**
 * Authentication service.
 * Inputs: User credentials/profile values plus Mongo collections for user lookups and creation.
 * Outputs: Validated session-safe user objects for signup and login flows.
 */
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { findUserByUsername, createUser, updateUserById } = require('./userRepository');

const getBootstrapAdmins = () =>
  (process.env.ADMIN_USERNAMES || '')
    .split(',')
    .map((username) => username.trim().toLowerCase())
    .filter(Boolean);

const shouldBootstrapAdmin = (username) => getBootstrapAdmins().includes((username || '').trim().toLowerCase());

const toSessionUser = (user) => ({
  id: user._id.toString(),
  username: user.username,
  name: user.name,
  role: user.role || 'candidate',
});

const ensureBootstrapAdminRole = async (collections, user) => {
  if (!user || user.role === 'admin' || !shouldBootstrapAdmin(user.username)) {
    return user;
  }

  return updateUserById(collections, user._id, { role: 'admin' });
};

const signupUser = async (collections, { username, name, password }) => {
  if (!username || !password) {
    const error = new Error('Username and password are required.');
    error.status = 400;
    throw error;
  }

  const existingUser = await findUserByUsername(collections, username);
  if (existingUser) {
    const error = new Error('Username already taken.');
    error.status = 400;
    throw error;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await createUser(collections, { username, name, passwordHash });
  const hydratedUser = await ensureBootstrapAdminRole(collections, user);
  return toSessionUser(hydratedUser);
};

const generateTemporaryPassword = () => crypto.randomBytes(9).toString('base64url');

const requestTemporaryPassword = async (collections, { username }) => {
  if (!username) {
    const error = new Error('Username is required.');
    error.status = 400;
    throw error;
  }

  const user = await findUserByUsername(collections, username);
  if (!user) {
    const error = new Error('No account found for that username.');
    error.status = 404;
    throw error;
  }

  const temporaryPassword = generateTemporaryPassword();
  const temporaryPasswordHash = await bcrypt.hash(temporaryPassword, 10);

  await updateUserById(collections, user._id, {
    temporaryPasswordHash,
    temporaryPasswordIssuedAt: new Date(),
  });

  return {
    username: user.username,
    temporaryPassword,
  };
};

const loginUser = async (collections, { username, password }) => {
  if (!username || !password) {
    const error = new Error('Username and password are required.');
    error.status = 400;
    throw error;
  }

  const user = await findUserByUsername(collections, username);
  if (!user) {
    const error = new Error('Invalid credentials.');
    error.status = 400;
    throw error;
  }

  const matchesPrimaryPassword = await bcrypt.compare(password, user.passwordHash || '');
  if (matchesPrimaryPassword) {
    const hydratedUser = await ensureBootstrapAdminRole(collections, user);
    return {
      user: toSessionUser(hydratedUser),
      usedTemporaryPassword: false,
    };
  }

  const matchesTemporaryPassword =
    user.temporaryPasswordHash &&
    (await bcrypt.compare(password, user.temporaryPasswordHash));

  if (!matchesTemporaryPassword) {
    const error = new Error('Invalid credentials.');
    error.status = 400;
    throw error;
  }

  const updatedUser = await updateUserById(collections, user._id, {
    temporaryPasswordHash: null,
    temporaryPasswordIssuedAt: null,
  });
  const hydratedUser = await ensureBootstrapAdminRole(collections, updatedUser);

  return {
    user: toSessionUser(hydratedUser),
    usedTemporaryPassword: true,
  };
};

module.exports = {
  toSessionUser,
  signupUser,
  loginUser,
  requestTemporaryPassword,
};
