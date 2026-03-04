# Virtual Interview Uploader (Dev Notes)

A small Express/EJS prototype for uploading resumes, previewing them, and wiring in future LLM + scoring features.

## Setup
1) **Install Node 18+** and npm.
2) **Install MongoDB locally** (Community Server): https://www.mongodb.com/try/download/community  
   Start it with `mongod` on the default port.
3) **Clone & install deps**
   ```bash
   npm install
   ```
4) **Environment (`.env`)**
   ```env
   PORT=3000
   MONGODB_URI=mongodb://127.0.0.1:27017
   MONGODB_DB=virtual_interview
   OPENAI_API_KEY=your-key-here   # needed when LLM scoring is wired in
   MODEL=gpt-4.1-mini
   WEB_SEARCH_ENDPOINT=https://serpapi.com/search.json   # if using SerpAPI
   WEB_SEARCH_KEY=your-serpapi-key
   ```
5) **Run**
   ```bash
   npm start
   # or in dev: npm run dev
   ```
6) Visit `http://localhost:3000` to upload a resume; uploads land in `/uploads`.

## Current Endpoints
- `GET /` � home
- `GET /upload` / `POST /upload` � upload & score resume
- `GET /results` � latest score view
- `GET /openai` � mock interviewer (auth required)
- `GET /openai/logs` � debug: recent transcripts (auth required)
- `GET /upload/preview/:id` � resume text preview (uses parsed text when available)

## TODO (next up)
- Plug in real resume text extraction in `src/utils/resumeParser.js` (parser still stubbed) and show parsed text in preview.
- Fix and harden web research integration (SerpAPI): correct request shape, error handling, env docs.
- Add interviewer personality presets/tuning controls.
- Expose interview history UI and per-turn analysis view (turns already stored).
- Broaden prompt diversity with more role-specific probes and follow-up behaviors.

## Notes
- Keep `.env` out of version control.
- Multer currently stores the raw file; text extraction is a stub until the parser is added.
- Mongo connection/scoring hooks are in progress; add them as you integrate the parser and persistence.
