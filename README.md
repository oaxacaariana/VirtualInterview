# Virtual Interview App

Express + EJS app for uploading resumes, scoring them with an LLM, and running a customizable mock interview.

## Setup
1) **Install Node 18+** and npm.
2) **Install MongoDB Community** and start `mongod`.
3) **Install deps**
   ```bash
   npm install
   ```
4) **Environment (`.env`)**
   ```env
   PORT=3000
   MONGODB_URI=mongodb://127.0.0.1:27017
   MONGODB_DB=virtual_interview
   OPENAI_API_KEY=your-key-here
   MODEL=gpt-4.1-mini
   WEB_SEARCH_ENDPOINT=https://serpapi.com/search.json   # optional
   WEB_SEARCH_KEY=your-serpapi-key                      # optional
   ```
5) **Run**
   ```bash
   npm start
   # or: npm run dev
   ```
6) Visit `http://localhost:3000`.

## Key Features
- Resume upload, scoring (0–100) with component breakdown, and results view.
- Resume archive/unarchive with dedicated Resumes page.
- Mock interviewer with:
  - Crazy mode (playful/parody tone, optional custom instructions).
  - Sliders (0–1) for seriousness, professionalism style, and difficulty.
  - Voice dictation (Web Speech API) with start/stop toggle.
- Resume preview endpoint.

## Routes / Endpoints
- `GET /` — Home.
- `GET /upload` / `POST /upload` — Upload & score a resume.
- `GET /results` — Latest score view (query `?resumeId=` to view a specific one).
- `GET /resumes` — Active resumes list; archive/unarchive controls.
- `GET /resumes?archived=1` — Archived resumes list.
- `GET /upload/preview/:id` — Resume text preview.
- `GET /openai` — Mock interviewer UI (auth required in production).
- `POST /openai/start` — Start interview (expects resumeId/company/role plus optional personality sliders).
- `POST /openai/ask` — Continue interview (prompt, transcript, same context).
- `POST /openai/close` — Mark chat closed.
- `GET /results?resumeId=:id` — Render results for a specific resume.

## Notes
- Uploads (resumes, avatars legacy) live under `/uploads`; served statically with caching.
- Line endings may normalize to CRLF on Windows when Git checks files out.
- Parser in `src/utils/resumeParser.js` is still a stub; replace with a real extractor as needed. 
