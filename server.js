/**
 * Application entry point.
 * Inputs: Environment variables plus the assembled Express app and database connection helpers.
 * Outputs: Starts the HTTP server, initializes MongoDB, and shuts resources down on SIGINT.
 */
require('dotenv').config();
const app = require('./src/server/app');
const { connectDb, closeDb, MONGODB_URI, MONGODB_DB } = require('./src/server/data/db');
const { getMongoConfig, DEFAULT_LOCAL_URI } = require('./src/server/shared/databaseConfig');

const PORT = process.env.PORT || 3000;
const mongoConfig = getMongoConfig();

if (!process.env.OPENAI_API_KEY) {
  console.warn(
    'Warning: OPENAI_API_KEY is not set. The OpenAI integration will return errors until you add it to .env'
  );
}

if (mongoConfig.mode === 'local') {
  console.log(`DB boot mode: local (${mongoConfig.uri}/${mongoConfig.dbName})`);
} else if (mongoConfig.mode === 'local-fallback') {
  console.warn(
    `Warning: MONGODB_URI not set. Defaulting to local instance at ${DEFAULT_LOCAL_URI}/${mongoConfig.dbName}`
  );
}

async function start() {
  try {
    await connectDb(app);

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`MongoDB connected to ${MONGODB_DB} via ${mongoConfig.displayName}`);
    });
  } catch (error) {
    console.error('Failed to start server', error);
    process.exit(1);
  }
}

start();

process.on('SIGINT', async () => {
  if (app.locals.sessionStore?.close) {
    await app.locals.sessionStore.close();
  }
  await closeDb();
  process.exit(0);
});
