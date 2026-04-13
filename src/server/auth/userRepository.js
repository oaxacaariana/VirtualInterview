/**
 * User repository.
 * Inputs: Mongo collections plus user identifiers, usernames, and update payloads.
 * Outputs: User records for authentication and profile flows.
 */
const { buildUser } = require('../data/persistence');
const { toObjectId } = require('../resumes/resumeRepository');

const normalizeUsername = (username) => username?.trim().toLowerCase();
const ADMIN_ROLES = new Set(['candidate', 'admin']);

const findUserByUsername = async (collections, username) => {
  if (!collections?.users) {
    return null;
  }

  return collections.users.findOne({ username: normalizeUsername(username) });
};

const findUserById = async (collections, userId) => {
  if (!collections?.users) {
    return null;
  }

  const normalizedUserId = toObjectId(userId);
  if (!normalizedUserId) {
    return null;
  }

  return collections.users.findOne({ _id: normalizedUserId });
};

const createUser = async (collections, { username, name, passwordHash }) => {
  if (!collections?.users) {
    throw new Error('User store unavailable.');
  }

  const userDoc = buildUser({
    username: normalizeUsername(username),
    name: name || username,
    passwordHash,
  });

  const { insertedId } = await collections.users.insertOne(userDoc);
  return {
    ...userDoc,
    _id: insertedId,
  };
};

const listUsers = async (collections, { search = '', limit = 200 } = {}) => {
  if (!collections?.users) {
    return [];
  }

  const normalizedSearch = search.trim().toLowerCase();
  const filter = normalizedSearch
    ? {
        $or: [
          { username: { $regex: normalizedSearch, $options: 'i' } },
          { name: { $regex: normalizedSearch, $options: 'i' } },
          { role: { $regex: normalizedSearch, $options: 'i' } },
        ],
      }
    : {};

  return collections.users
    .find(filter)
    .sort({ createdAt: -1, username: 1 })
    .limit(Math.max(1, Math.min(Number(limit) || 200, 500)))
    .toArray();
};

const updateUserById = async (collections, userId, updates) => {
  if (!collections?.users) {
    throw new Error('User store unavailable.');
  }

  const normalizedUserId = toObjectId(userId);
  if (!normalizedUserId) {
    throw new Error('Invalid user id.');
  }

  const normalizedUpdates = {};

  if (Object.prototype.hasOwnProperty.call(updates, 'username')) {
    normalizedUpdates.username = normalizeUsername(updates.username);
  }

  if (Object.prototype.hasOwnProperty.call(updates, 'name')) {
    normalizedUpdates.name = updates.name?.trim() || '';
  }

  if (Object.prototype.hasOwnProperty.call(updates, 'passwordHash')) {
    normalizedUpdates.passwordHash = updates.passwordHash;
  }

  if (Object.prototype.hasOwnProperty.call(updates, 'role')) {
    const normalizedRole = String(updates.role || '').trim().toLowerCase();
    if (!ADMIN_ROLES.has(normalizedRole)) {
      throw new Error('Invalid user role.');
    }
    normalizedUpdates.role = normalizedRole;
  }

  normalizedUpdates.updatedAt = new Date();

  await collections.users.updateOne({ _id: normalizedUserId }, { $set: normalizedUpdates });
  return findUserById(collections, normalizedUserId);
};

module.exports = {
  ADMIN_ROLES,
  normalizeUsername,
  findUserByUsername,
  findUserById,
  createUser,
  listUsers,
  updateUserById,
};
