# Virtual Interview App

Express + EJS app for uploading resumes, scoring them against a target role, and running a customizable mock interview workflow.

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
- resume scoring against a job description
- archived and active resume management
- mock interview generation with stored context
- transcript history and interview review persistence

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
