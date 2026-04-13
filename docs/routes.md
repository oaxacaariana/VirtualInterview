# Routes and Flows

## Public Routes

### `GET /`

Renders the home page.

### `GET /login`

Renders the login form.

### `POST /login`

Authenticates a user and establishes a session.

### `GET /signup`

Renders the signup form.

### `POST /signup`

Creates a user account and signs the user in.

## Authenticated View Routes

### `GET /upload`

Renders the resume upload page.

### `POST /upload`

Processes an uploaded resume and renders the results page.

### `GET /upload/preview/:id`

Shows a stored resume preview.

### `GET /results`

Renders the results page, optionally for a specific `resumeId`.

### `GET /resumes`

Renders the active resumes list.

### `GET /resumes?archived=1`

Renders archived resumes.

### `POST /resumes/:id/archive`

Archives a resume.

### `POST /resumes/:id/unarchive`

Unarchives a resume.

### `GET /profile`

Renders the user profile page.

### `POST /profile`

Updates the user profile.

## Admin Routes

All `/admin/*` routes require an authenticated admin account.

### `GET /admin/users`

Renders the admin user-management index.

### `GET /admin/users/:userId`

Renders one user's admin detail page.

### `POST /admin/users/:userId`

Updates another user's username, display name, role, or password.

### `GET /admin/users/:userId/resumes`

Renders the selected user's stored resumes.

### `GET /admin/users/:userId/resumes/:resumeId`

Renders the selected user's full resume score page.

### `GET /admin/users/:userId/resumes/:resumeId/preview`

Shows an admin preview of the stored resume text.

### `GET /admin/users/:userId/chats`

Renders the selected user's saved chat logs.

### `GET /admin/users/:userId/chats/:chatId`

Renders the selected user's saved chat log detail page.

## Interview Routes

### `GET /openai`

Renders the interview page with the avatar stage, setup modal, transcript/coach panels, and browser-side camera or voice controls.

### `POST /openai/start`

Starts an interview session.

### `POST /openai/ask`

Continues an interview session with the next turn.

### `POST /openai/close`

Closes the current interview and triggers final review behavior.

### `GET /openai/review`

Fetches review data for an interview turn.

### `POST /openai/tts`

Generates interviewer speech audio for browser playback.

### `GET /openai/logs`

Renders transcript history.

### `GET /openai/logs.json`

Returns transcript summaries as JSON.

### `GET /openai/logs/:chatId`

Renders transcript details for one chat.

## High-Level Resume Flow

1. User uploads a resume.
2. Resume metadata is persisted.
3. Resume text is parsed.
4. Optional web research is run.
5. OpenAI scoring is generated.
6. Score metadata is persisted.
7. Results are rendered.

## High-Level Interview Flow

1. User selects a resume and enters interview context.
2. The app loads resume text and prior context.
3. The browser can enable microphone input, camera preview, and optional eye-contact tracking.
4. The app generates interview prompts with OpenAI.
5. Interviewer replies can be spoken back through the TTS endpoint.
6. Each turn is persisted.
7. Turn reviews are generated asynchronously.
8. Final review is generated when the interview is closed.

## High-Level Admin Flow

1. Admin opens the user-management index.
2. Admin searches for a user and opens the account detail page.
3. Admin edits account information or opens the user's resume/chat history views.
4. Admin can inspect stored resume scores, preview resume text, and review interview transcripts plus final interview scores.
