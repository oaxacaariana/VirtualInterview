/**
 * MongoDB connection and collection bootstrap module.
 * Inputs: Mongo connection settings from environment variables and the Express app instance.
 * Outputs: Connected Mongo client/database handles, initialized collections, and collection indexes.
 */
const { MongoClient } = require('mongodb');
const { getMongoConfig } = require('../shared/databaseConfig');

const { uri: MONGODB_URI, dbName: MONGODB_DB } = getMongoConfig();
const client = new MongoClient(MONGODB_URI);

async function connectDb(app) {
  await client.connect();
  const db = client.db(MONGODB_DB);

  const collections = {
    users: db.collection('users'),
    chatLogs: db.collection('chatLogs'),
    chatTurns: db.collection('chatTurns'),
    interviewScores: db.collection('interviewScores'),
    resumeScores: db.collection('resumeScores'),
    resumeFiles: db.collection('resumeFiles'),
  };

  app.locals.db = db;
  app.locals.collections = collections;

  await Promise.all([
    collections.users.createIndex({ username: 1 }, { unique: true }),
    collections.chatLogs.createIndex({ userId: 1, createdAt: -1 }, { name: 'user_transcripts' }),
    collections.chatLogs.createIndex({ chatId: 1 }, { name: 'chat_lookup' }),
    collections.chatLogs.createIndex({ sessionId: 1 }, { name: 'session_lookup' }),
    collections.chatTurns.createIndex({ chatId: 1, turn: 1 }, { name: 'chat_turns' }),
    collections.chatTurns.createIndex({ userId: 1, createdAt: -1 }, { name: 'user_turns' }),
    collections.interviewScores.createIndex(
      { userId: 1, createdAt: -1 },
      { name: 'user_scores' }
    ),
    collections.interviewScores.createIndex(
      { userId: 1, chatId: 1 },
      { name: 'user_chat_score', unique: true }
    ),
    collections.resumeScores.createIndex(
      { userId: 1, createdAt: -1 },
      { name: 'user_resume_scores' }
    ),
    collections.resumeFiles.createIndex(
      { userId: 1, uploadedAt: -1 },
      { name: 'user_resume_files' }
    ),
  ]);

  return { client, db, collections };
}

async function closeDb() {
  await client.close();
}

module.exports = {
  connectDb,
  closeDb,
  MONGODB_URI,
  MONGODB_DB,
};
