/**
 * Database boot configuration helper.
 * Inputs: Environment variables describing preferred Mongo target and optional local overrides.
 * Outputs: Normalized Mongo connection settings shared by app startup and session storage.
 */
const DEFAULT_LOCAL_URI = 'mongodb://127.0.0.1:27017';
const DEFAULT_DB_NAME = 'virtual_interview';

const isTruthy = (value) => {
  if (typeof value === 'boolean') return value;
  if (typeof value !== 'string') return false;
  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
};

const getMongoConfig = () => {
  const bootMode = (process.env.DB_BOOT_MODE || '').trim().toLowerCase();
  const useLocalDb = bootMode === 'local' || isTruthy(process.env.USE_LOCAL_DB);

  if (useLocalDb) {
    return {
      mode: 'local',
      uri: process.env.LOCAL_MONGODB_URI || DEFAULT_LOCAL_URI,
      dbName: process.env.LOCAL_MONGODB_DB || process.env.MONGODB_DB || DEFAULT_DB_NAME,
      displayName: 'local MongoDB',
    };
  }

  if (process.env.MONGODB_URI) {
    return {
      mode: 'remote',
      uri: process.env.MONGODB_URI,
      dbName: process.env.MONGODB_DB || DEFAULT_DB_NAME,
      displayName: 'configured MongoDB',
    };
  }

  return {
    mode: 'local-fallback',
    uri: process.env.LOCAL_MONGODB_URI || DEFAULT_LOCAL_URI,
    dbName: process.env.LOCAL_MONGODB_DB || process.env.MONGODB_DB || DEFAULT_DB_NAME,
    displayName: 'local MongoDB fallback',
  };
};

module.exports = {
  DEFAULT_LOCAL_URI,
  DEFAULT_DB_NAME,
  getMongoConfig,
};
