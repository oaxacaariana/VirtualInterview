---
layout: default
title: Data Model
---

# Data Model

<section class="glass docs-hero">
  <p class="eyebrow">Database Overview</p>
  <h2>Mongo-backed records for users, resumes, interviews, and sessions</h2>
  <p>
    The application stores identity, uploaded resume metadata, resume scoring output, chat history,
    turn-by-turn interview state, final review summaries, and session records in MongoDB. Most
    relationships are anchored around the user, then branch into resume and interview flows.
  </p>
</section>

## MongoDB Collections

The app currently uses these collections:

- `users`
- `chatLogs`
- `chatTurns`
- `interviewScores`
- `resumeScores`
- `resumeFiles`
- session collection, defaulting to `sessions`

## Relationship Summary

- one user has many resume files
- one user has many resume scores
- one resume file can have many score snapshots over time
- one user has many chat logs
- one chat log has many chat turns
- one chat log can have zero or one final interview score
- sessions are standalone store records used by Express session middleware

## Entity Relationship Diagram

<div class="diagram-frame">
  <img src="{{ '/photos/ErDiagram.png' | relative_url }}" alt="Entity relationship diagram for the Virtual Interview database">
</div>

## `users`

Purpose:

- stores login identity and profile-facing user data

Key fields:

- `username`
- `name`
- `passwordHash`
- `role`
- `createdAt`

Relationships:

- parent record for resume files, resume scores, chat logs, chat turns, and interview scores

## `resumeFiles`

Purpose:

- stores uploaded resume metadata and file location information

Key fields:

- `userId`
- `originalName`
- `storedName`
- `path`
- `size`
- `mimeType`
- `uploadedAt`
- `archived`

Relationships:

- belongs to one user
- can have many related `resumeScores`

## `resumeScores`

Purpose:

- stores the score output for a specific resume evaluation run

Key fields:

- `userId`
- `resumeId`
- `score`
- `rubric`
- `title`
- `summary`
- `positives`
- `negatives`
- `company`
- `jobSnippet`
- `createdAt`

Relationships:

- belongs to one user
- belongs to one resume file

Notes:

- multiple score documents can exist for the same resume if the user re-scores it against different role or company context

## `chatLogs`

Purpose:

- stores the top-level transcript and interview context for a chat session

Key fields:

- `type`
- `userId`
- `sessionId`
- `chatId`
- `status`
- `model`
- `context`
- `messages`
- `createdAt`
- `updatedAt`

Relationships:

- belongs to one user
- parent record for `chatTurns`
- can be associated with one final `interviewScores` document through `chatId`

Notes:

- `context` stores resume and interview metadata such as role, company, web research signals, and cached prompt context

## `chatTurns`

Purpose:

- stores each individual interview turn for a chat session

Key fields:

- `type`
- `userId`
- `sessionId`
- `chatId`
- `model`
- `turn`
- `questionAsked`
- `prompt`
- `reply`
- `review`
- `createdAt`

Relationships:

- belongs to one user
- grouped under a chat log through `chatId`

Notes:

- `review` may be null until asynchronous review generation completes

## `interviewScores`

Purpose:

- stores final interview evaluation output after the session is closed

Key fields:

- `userId`
- `sessionId`
- `chatId`
- `overallScore`
- `grade`
- `rubric`
- `summary`
- `strengths`
- `improvements`
- `strongestArea`
- `weakestArea`
- `patterns`
- `reviewedTurns`
- `createdAt`

Relationships:

- belongs to one user
- associated to one chat session by `chatId`

## Sessions

The app uses a custom Mongo-backed session store.

Stored session documents include:

- session payload
- expiration time
- timestamps

Purpose:

- keeps authenticated browser sessions alive across requests and across deploy/runtime restarts

Notes:

- session documents are infrastructure records rather than business-domain entities
- session records are not modeled as foreign keys to users in the current store format
