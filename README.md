# Virtual Interview App

Express + EJS app for uploading resumes, scoring them against a target role with qualitative fit labels, and running a customizable mock interview workflow with configurable interviewer personas, voices, and review scoring.

## Quick Start

1. Install Node.js 18+ and npm.
2. Install dependencies:

   ```bash
   npm install
   ```

3. Create a `.env` file:

   ```env
   OPENAI_API_KEY=your-openai-key
   MONGODB_URI=your-mongodb-uri
   MONGODB_DB=VirtualInterview
   SESSION_SECRET=replace-with-a-long-random-secret
   NODE_ENV=development
   MODEL=gpt-4.1-mini
   REVIEW_MODEL=gpt-4.1-mini
   TTS_MODEL=gpt-4o-mini-tts
   TRANSCRIBE_MODEL=gpt-4o-mini-transcribe
   ```

4. Start the app:

   ```bash
   npm run dev
   ```

5. Visit `http://localhost:3000`.

## Documentation

Project docs live in the [`docs/`](./docs/index.md) folder and are designed to be published with GitHub Pages.

- [Docs Home](./docs/index.md)
- [Architecture](./docs/architecture.md)
- [Setup](./docs/setup.md)
- [Environment Variables](./docs/environment.md)
- [Deployment](./docs/deployment.md)
- [Routes and Flows](./docs/routes.md)
- [Data Model](./docs/data-model.md)

## Main Features

- account creation and login
- resume upload and preview
- resume scoring against a job description with qualitative fit labels
- archived and active resume management
- mock interview generation with stored context, selectable interviewer personas, and TTS voices
- transcript history, graded interview review persistence, and DNF archives for incomplete chats

## Tech Stack

- Node.js
- Express
- EJS
- MongoDB
- OpenAI API
- Multer

## Notes

- uploaded files live in the top-level `uploads/` directory
- sessions are stored in MongoDB
- docs are intended to be published from the `/docs` folder using GitHub Pages
