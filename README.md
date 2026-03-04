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
   ```
5) **Run**
   ```bash
   npm start
   # or in dev: npm run dev
   ```
6) Visit `http://localhost:3000` to upload a resume; uploads land in `/uploads`.

## Current Endpoints
- `GET /` – upload form (home page)
- `POST /upload` – saves the file to `uploads/` (via Multer)
- `GET /upload/preview/:id` – placeholder for viewing parsed text (to be wired once parser + DB are added)

## TODO (PDF parser + scoring)
- Implement real resume text extraction in `src/utils/resumeParser.js` (replace the stub with `pdf-parse` or similar).
- Store extracted text alongside metadata (or instead of the raw file) once parsing works.
- Update preview endpoint (`GET /upload/preview/:id`) to show parsed text and fail gracefully on binary-only content.
- Re-enable LLM fit scoring using extracted resume text + job description.
- Remove temporary fallbacks in `uploadController.js` once parser is in place.

## Notes
- Keep `.env` out of version control.
- Multer currently stores the raw file; text extraction is a stub until the parser is added.
- Mongo connection/scoring hooks are in progress; add them as you integrate the parser and persistence.
