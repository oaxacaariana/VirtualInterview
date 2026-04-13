# Environment Variables

## Required

### `OPENAI_API_KEY`

Used by:

- resume scoring
- interview generation
- interview review flow
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

Optional override for interview review generation.

If omitted, the app falls back to `MODEL`.

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
