# Virtual Interview Docs

This documentation hub is designed for ongoing project maintenance, onboarding, and future feature work.

## Start Here

- [Project Overview](./overview.md)
- [Architecture](./architecture.md)
- [Setup](./setup.md)
- [Environment Variables](./environment.md)
- [Deployment](./deployment.md)
- [Routes and Flows](./routes.md)
- [Data Model](./data-model.md)
- [Development Notes](./development.md)

## What This App Does

Virtual Interview is an Express + EJS application for:

- account creation and login
- resume upload and storage
- resume scoring against a target job description
- mock interview generation using OpenAI
- transcript history and review persistence

## Current Stack

- Node.js
- Express
- EJS
- MongoDB
- OpenAI API
- Multer for uploads

## Publishing With GitHub Pages

This `docs/` folder is ready to publish with GitHub Pages.

Recommended repo settings:

1. Open GitHub repository settings.
2. Go to `Pages`.
3. Set source to `Deploy from a branch`.
4. Choose the main branch.
5. Choose the `/docs` folder.
6. Save.

GitHub Pages will then publish this folder as the project docs site.
