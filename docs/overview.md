# Project Overview

## Summary

Virtual Interview helps a user prepare for job applications by combining resume analysis and interview practice in one workflow.

The app currently supports:

- user signup and login
- bootstrap admin promotion by configured username
- resume upload and preview
- resume scoring against a job description with qualitative fit labels and rubric breakdowns
- archived and active resume views
- interview session generation with selectable interviewer personas and voices
- avatar-based interview screen with side panels and subtitles
- browser speech-to-text plus server-side transcription for user responses
- OpenAI text-to-speech for interviewer responses
- optional camera preview and eye-contact tracking during interviews
- interview transcript persistence
- post-interview scoring that emphasizes relevance, role fit, and structured answers, plus DNF handling for incomplete chats
- admin-only access to user accounts, resumes, and chat logs

## Main User Journey

1. A user creates an account or logs in.
2. The user uploads a resume and optionally provides company and job description context.
3. The app parses the resume and generates a qualitative fit scorecard plus a rubric-backed breakdown.
4. The user can review saved resumes and prior score results.
5. The user starts a mock interview using a selected resume, persona, and voice.
6. The interview begins with a short human intro, starts with easier rapport-building questions, then ramps into harder follow-ups.
7. The interview screen can use browser mic, camera, subtitles, and eye-contact tracking while the conversation runs.
8. The app stores interview turns, chat logs, and final review data.

## Admin Workflow

1. An account is promoted to `admin` through the configured bootstrap usernames list.
2. The admin opens the admin panel from the main navigation or profile page.
3. The admin can search users, open an account detail page, and edit identity/role/password fields.
4. The admin can inspect that user's stored resumes, full resume score pages, resume previews, chat logs, and chat-log detail pages.

## Current Runtime Shape

- server-rendered application
- Express routes and controllers
- MongoDB-backed persistence
- custom Mongo-backed session store
- browser-side JavaScript for interview interactions, voice input, transcription requests, TTS playback, camera preview, and eye-tracking hooks
