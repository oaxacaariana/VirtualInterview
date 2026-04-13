# Architecture

## Top-Level Layout

The backend is grouped under `src/server` by domain and responsibility:

```text
src/
  server/
    app.js
    admin/
    auth/
    resumes/
    interviews/
    home/
    routes/
    data/
    shared/
  public/
    scripts/
    styles/
  views/
```

## Backend Groupings

### `src/server/app.js`

Application assembly:

- Express setup
- session middleware
- static file configuration
- route mounting
- auth guard wiring

### `src/server/routes`

HTTP route registration only.

Each route file maps URLs to controller handlers.

### `src/server/auth`

Account and profile behavior:

- `authController.js`
- `authService.js`
- `profileController.js`
- `userRepository.js`

### `src/server/admin`

Admin-only user management and read access:

- `adminController.js`

### `src/server/resumes`

Resume upload, lookup, scoring, and rendering:

- `resumeController.js`
- `resumeService.js`
- `resumeScoringService.js`
- `resumeRepository.js`

### `src/server/interviews`

Interview generation, transcript persistence, and review flow:

- `interviewController.js`
- `transcriptController.js`
- `interviewService.js`
- `interviewContextService.js`
- `interviewPromptBuilder.js`
- `interviewValidators.js`
- `reviewService.js`
- `transcriptService.js`
- `chatRepository.js`
- `interviewScoreRepository.js`

### `src/server/data`

Persistence infrastructure:

- `db.js` for Mongo connection and collection setup
- `persistence.js` for document builders

### `src/server/shared`

Cross-cutting helpers:

- OpenAI client setup
- Mongo session store
- resume parsing
- score color mapping
- web research support

## Request Flow

Typical backend flow:

1. Route receives request.
2. Controller handles HTTP details.
3. Service performs app/domain logic.
4. Repository reads or writes MongoDB data when needed.
5. Controller renders a view or returns JSON.

Admin-only routes follow the same pattern, but they reuse existing resume/interview services with an admin-selected target user instead of the current session owner.

## Frontend Layout

Frontend assets are split into:

- `src/views` for EJS templates
- `src/public/scripts` for browser-side logic
- `src/public/styles` for grouped CSS

CSS grouping:

- `foundation/` for base and responsive rules
- `shared/` for reusable components
- `pages/` for page-specific styling
