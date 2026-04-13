# Deployment

## Current Deployment Assumptions

The app is designed to run on a Node hosting platform such as Railway.

Core deployment requirements:

- Node runtime
- MongoDB access
- required environment variables
- writable runtime storage for uploaded files

## Railway Notes

### Required Variables

Set these in Railway:

```env
OPENAI_API_KEY=...
MONGODB_URI=...
MONGODB_DB=VirtualInterview
SESSION_SECRET=...
NODE_ENV=production
MODEL=gpt-4.1-mini
REVIEW_MODEL=gpt-4.1-mini
```

### Common Failure Point

The most common deployment issue is MongoDB Atlas connectivity.

Check:

- Atlas network access
- exact `MONGODB_URI`
- database user credentials
- TLS/network access between Railway and Atlas

### Port Binding

The app listens using the `PORT` value supplied by the platform.

## Deployment Checklist

1. Push the latest code.
2. Configure environment variables.
3. Confirm Atlas network access is valid.
4. Deploy.
5. Open the app URL.
6. Verify:
   - signup/login
   - resume upload
   - interview page
   - Mongo-backed persistence

## File Upload Note

The application currently stores uploaded files on disk in `uploads/`.

For long-term production use, consider documenting or later migrating to:

- persistent volume storage
- object storage

## GitHub Pages Docs Publishing

This docs site can be published separately from the app:

1. Go to GitHub repo settings.
2. Open `Pages`.
3. Set source to main branch `/docs`.
4. Save.
