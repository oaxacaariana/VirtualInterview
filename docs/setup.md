# Setup

## Requirements

- Node.js 18+
- npm
- MongoDB Atlas or local MongoDB
- OpenAI API key
- a modern desktop browser for microphone, camera, and speech features

## Install

```bash
npm install
```

## Local Environment

Create a `.env` file in the project root.

Minimum recommended local configuration:

```env
OPENAI_API_KEY=your-openai-key
MONGODB_URI=your-mongodb-uri
MONGODB_DB=VirtualInterview
SESSION_SECRET=some-long-random-string
NODE_ENV=development
MODEL=gpt-4.1-mini
REVIEW_MODEL=gpt-4.1-mini
TTS_MODEL=gpt-4o-mini-tts
TRANSCRIBE_MODEL=gpt-4o-mini-transcribe
```

If you want to boot against a local MongoDB instance instead of Atlas:

```env
DB_BOOT_MODE=local
LOCAL_MONGODB_URI=mongodb://127.0.0.1:27017
LOCAL_MONGODB_DB=VirtualInterviewLocal
```

If you want to bootstrap one or more admin accounts, add:

```env
ADMIN_USERNAMES=yourusername
```

Any listed username will be promoted to `admin` the next time that user signs up or logs in.

## Run Locally

Development:

```bash
npm run dev
```

Production-style local run:

```bash
npm start
```

## Default Entry Point

The application starts from:

```text
server.js
```

That file loads:

- environment variables
- the Express app from `src/server/app.js`
- the MongoDB connection

## Notes

- Uploaded files are stored in the top-level `uploads/` directory.
- The app creates `uploads/` automatically if it does not exist.
- The resume parser currently supports PDF and DOCX inputs using the current parser implementation in `src/server/shared/resumeParser.js`.
- The interview UI serves local eye-tracking assets from `src/public/models/` and `src/public/mediapipe/`.
- Voice input depends on browser speech-recognition support.
- The app can also use the server-side `/openai/transcribe` endpoint for recorded interview audio.
- Camera preview and eye-contact tracking require the user to grant browser camera access.
- Interviewer TTS requires a valid `OPENAI_API_KEY` because it is generated server-side through OpenAI.
- The default interviewer voice model is `gpt-4o-mini-tts`, and the setup modal can override voice and speaking style per interview.
