# Environment Variables

## Required

### `OPENAI_API_KEY`

Used by:

- resume scoring
- interview generation
- interview review flow
- interviewer text-to-speech generation
- optional web research flow

### `MONGODB_URI`

MongoDB connection string for Atlas or local MongoDB.

### `MONGODB_DB`

Database name used by the app.

### `SESSION_SECRET`

Used to sign Express sessions.

This must be set in production.

## Optional

### `PORT`

Usually provided automatically by deployment platforms such as Railway.

### `NODE_ENV`

Recommended values:

- `development` for local work
- `production` for deployed environments

### `MODEL`

Primary OpenAI model used by the app.

Current default in code:

```env
gpt-4.1-mini
```

### `REVIEW_MODEL`

Optional override for turn-level interview review generation.

If omitted, the app falls back to `MODEL`.

Current behavior in code:

- `REVIEW_MODEL` is used for per-turn review feedback generated after each answer
- final interview review generation currently uses `MODEL`

### `TTS_MODEL`

Optional OpenAI model used for interviewer text-to-speech generation.

Current default in code:

```env
gpt-4o-mini-tts
```

This default supports promptable speech instructions.

### `TTS_VOICE`

Optional fallback TTS voice for interviewer playback.

Current default in code:

```env
shimmer
```

The interview setup UI also exposes selectable persona-linked voices such as `alloy`, `echo`, `nova`, `onyx`, `ballad`, `cedar`, `marin`, and `verse`.

### `TTS_FORMAT`

Optional audio format returned by the TTS endpoint.

Current default in code:

```env
mp3
```

### `TTS_INSTRUCTIONS`

Optional fallback speech-style instructions used when a request does not provide persona-specific TTS instructions.

Current default in code:

```env
Speak like a calm, professional mock interviewer. Sound clear, confident, and encouraging.
```

### `TRANSCRIBE_MODEL`

Optional OpenAI model used by `/openai/transcribe`.

Current default in code:

```env
gpt-4o-mini-transcribe
```

### `TRANSCRIBE_LANGUAGE`

Optional default language hint for interview transcription.

Current default in code:

```env
en
```

### `TRANSCRIBE_PROMPT`

Optional default transcription prompt.

Current default in code:

```env
Transcribe spoken interview answers clearly, preserving punctuation and common technical terms.
```

### `SESSION_COLLECTION`

Optional override for the MongoDB collection used by the session store.

### `ADMIN_USERNAMES`

Optional comma-separated bootstrap list of usernames that should be promoted to `admin` when they sign up or log in.

Example:

```env
ADMIN_USERNAMES=ariana,teamlead
```

This variable only promotes matching accounts to the `admin` role.
It does not create accounts and it does not assign a default password.

### `DB_BOOT_MODE`

Optional database boot selector.

Recommended values:

- `local` to force the app to boot against local MongoDB
- omit it to use `MONGODB_URI` normally

### `USE_LOCAL_DB`

Optional boolean shortcut for local development.

Truthy values such as `true`, `1`, or `yes` force local MongoDB boot.

### `LOCAL_MONGODB_URI`

Optional override for the local MongoDB URI when `DB_BOOT_MODE=local`.

Default in code:

```env
mongodb://127.0.0.1:27017
```

### `LOCAL_MONGODB_DB`

Optional override for the local database name when `DB_BOOT_MODE=local`.

## Example

```env
OPENAI_API_KEY=your-openai-key
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/VirtualInterview?retryWrites=true&w=majority
MONGODB_DB=VirtualInterview
SESSION_SECRET=replace-with-a-long-random-secret
NODE_ENV=production
MODEL=gpt-4.1-mini
REVIEW_MODEL=gpt-4.1-mini
TTS_MODEL=gpt-4o-mini-tts
TTS_VOICE=shimmer
TTS_FORMAT=mp3
TRANSCRIBE_MODEL=gpt-4o-mini-transcribe
TRANSCRIBE_LANGUAGE=en
```

Local MongoDB override example:

```env
DB_BOOT_MODE=local
LOCAL_MONGODB_URI=mongodb://127.0.0.1:27017
LOCAL_MONGODB_DB=VirtualInterviewLocal
```

## Notes

- Do not commit `.env`.
- Rotate secrets if they are ever pasted into chat, screenshots, or Git history.
- Atlas passwords with special characters must be URL-encoded in `MONGODB_URI`.
- `DB_BOOT_MODE=local` makes both the main app connection and the session store use local MongoDB together.
- Persona-specific TTS instructions chosen in the interview setup flow override the global `TTS_INSTRUCTIONS` fallback for that session.
