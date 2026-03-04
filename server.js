require('dotenv').config();
const app = require('./src/app');
const { connectDb, closeDb, MONGODB_URI, MONGODB_DB } = require('./src/db/db');

const PORT = process.env.PORT || 3000;

if (!process.env.OPENAI_API_KEY) {
  console.warn(
    'Warning: OPENAI_API_KEY is not set. The OpenAI integration will return errors until you add it to .env'
  );
}

if (!process.env.MONGODB_URI) {
  console.warn(
    `Warning: MONGODB_URI not set. Defaulting to local instance at ${MONGODB_URI}/${MONGODB_DB}`
  );
}

async function start() {
  try {
    await connectDb(app);

    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
      console.log(`MongoDB connected to ${MONGODB_DB}`);
    });
  } catch (error) {
    console.error('Failed to start server', error);
    process.exit(1);
  }
}

start();

process.on('SIGINT', async () => {
  await closeDb();
  process.exit(0);
});
