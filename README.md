# Virtual Interview

An Express + EJS application for resume scoring, role-specific mock interviews, and saved interview coaching. The current product already supports authenticated users, persisted resumes, transcript history, inline answer review, and final interview grading.

The current build focus is the visual interview layer: adding an interviewer avatar, detecting the interviewee's camera, and making the interview experience feel more like a polished main-stage product instead of a text-first tool.

## Current Status

What is working now:

- User signup, login, logout, and session-backed protected routes
- Resume upload with MongoDB metadata storage and local file storage in `uploads/`
- Resume scoring against a target company and job description
- Resume archive and unarchive flow
- Main landing page with a presentable product overview
- Mock interview setup with company, role, resume selection, web research toggle, crazy mode, and behavior sliders
- Interview chat with transcript persistence, voice dictation, inactivity timeout, inline turn coaching, and final scorecard generation
- Chat log history and per-session detail views

What is still in progress:

- Visual interviewer/avatar on the interview page
- Camera detection and live interviewee presence in the UI
- Stronger interview page presentation so the experience feels closer to a real interview room

Known limitations right now:

- Resume parsing is best-effort and still needs cleanup, especially for `.docx`
- The app uses server-rendered EJS and vanilla browser scripts rather than a component frontend
- There is no webcam pipeline yet
- There is no avatar rendering pipeline yet

## Product Flow

1. Create an account and sign in.
2. Upload a resume and score it against a job description.
3. Save that resume in the resume vault.
4. Start a mock interview using a saved resume, target company, target role, and interview behavior controls.
5. Answer questions by typing or using browser speech recognition.
6. Review inline coaching during the session and a final interview review after ending the chat.
7. Revisit old transcripts and scorecards from chat logs.

## Architecture

Backend:

- `server.js` loads environment variables, connects to MongoDB, and starts the Express server.
- `src/app.js` wires middleware, sessions, static assets, auth gating, and route registration.
- `src/controllers/` handles page rendering and request orchestration.
- `src/services/interview/` contains the interview workflow, prompt building, context loading, transcript persistence, validation, and review generation.
- `src/repositories/` isolates MongoDB access for resumes, chat logs, and interview scores.
- `src/utils/` contains resume parsing, score color mapping, and OpenAI web research helpers.
- `src/lib/openaiClient.js` centralizes OpenAI client/model configuration.

Frontend:

- `src/views/` contains server-rendered EJS pages.
- `src/views/openai.ejs` is the main interview experience today.
- `src/public/scripts/openai/` contains the interview client logic for state, API calls, modal setup, transcript rendering, storage, and voice input.
- `src/public/stylesheets/` contains shared and page-level styling.

Persistence:

- MongoDB collections: `users`, `resumeFiles`, `resumeScores`, `chatLogs`, `chatTurns`, `interviewScores`
- Local uploaded files are stored under `uploads/`

## Main Areas In The Repo

- `src/views/home.ejs`: marketing-style landing page
- `src/views/openai.ejs`: current mock interview UI and best location for avatar/camera work
- `src/public/scripts/openai/index.js`: main interview state machine and event wiring
- `src/public/scripts/openai/voiceInput.js`: browser speech recognition support
- `src/services/interview/interviewService.js`: start, continue, and finalize interview flow
- `src/services/interview/interviewContextService.js`: resume/job/research context assembly
- `src/controllers/uploadController.js`: resume upload and scoring flow
- `src/controllers/resultsController.js`: score display
- `src/controllers/resumesController.js`: resume vault and archive flow

## Current Interview Experience

The interview page already supports:

- Resume selection from previously scored uploads
- Company and role targeting
- Optional OpenAI web research for added company context
- Interviewer behavior controls for seriousness, style, difficulty, and complexity
- Optional crazy mode with custom tone instructions
- Persistent chat state in the browser
- Turn-by-turn transcript saving in MongoDB
- Async inline answer coaching
- Final interview scoring and rubric generation
- Voice dictation through the browser Web Speech API
- Auto-close after 30 minutes of inactivity

The interview page does not yet support:

- Camera preview or permission handling
- Face/presence detection
- Avatar rendering for the interviewer
- A split-screen or stage-style interview layout

## Next Goal

The next milestone is to transform the current text-centered interview page into a more visual interview room.

Priority goals:

- Add an interviewer avatar to represent the AI interviewer
- Start camera access and interviewee detection on the interview page
- Redesign the interview layout so the main page feels more polished and presentation-ready

Likely implementation area:

- Primary UI work will live in `src/views/openai.ejs`
- Client-side camera/avatar logic will likely live in `src/public/scripts/openai/`
- Supporting styles will likely live in `src/public/stylesheets/`

## Setup

1. Install Node.js 18+ and npm.
2. Install MongoDB Community Edition and start `mongod`.
3. Install dependencies:

```bash
npm install
```

4. Create `.env`:

```env
PORT=3000
MONGODB_URI=mongodb://127.0.0.1:27017
MONGODB_DB=virtual_interview
OPENAI_API_KEY=your-key-here
MODEL=gpt-4.1-mini
REVIEW_MODEL=gpt-4.1-mini
SESSION_SECRET=replace-me-in-production
```

5. Run the app:

```bash
npm start
```

For development:

```bash
npm run dev
```

6. Visit `http://localhost:3000`

## Routes

Pages:

- `GET /` home page
- `GET /login` login page
- `GET /signup` signup page
- `GET /profile` user profile
- `GET /upload` resume upload page
- `GET /results` latest or selected resume score
- `GET /resumes` active resume vault
- `GET /resumes?archived=1` archived resumes
- `GET /openai` interview page
- `GET /openai/logs` interview transcript history
- `GET /openai/logs/:chatId` transcript detail view

Interview API:

- `POST /openai/start` start a new interview
- `POST /openai/ask` continue an interview
- `POST /openai/close` finalize an interview and generate the final review
- `GET /openai/review?chatId=:id&turn=:n` fetch async turn coaching
- `GET /openai/logs.json` fetch recent transcript metadata

Resume helpers:

- `POST /upload` upload and score a resume
- `GET /upload/preview/:id` preview extracted resume text

## Notes

- Protected routes rely on `express-session`.
- The OpenAI interview and review flows will fail without `OPENAI_API_KEY`.
- Uploaded files are stored locally and served from `/uploads`.
- Resume parsing is implemented in `src/utils/resumeParser.js` and remains an area for improvement.
