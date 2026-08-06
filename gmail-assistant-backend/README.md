# Gmail Assistant Backend

This is the Python backend for the protected Gmail Assistant area on the games site.

## Local Run

```bash
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

## Required Environment Variables

- `GOOGLE_CLIENT_SECRET_JSON`: Full Google OAuth client secret JSON as a single-line string.
- `GMAIL_OAUTH_REDIRECT_URI`: Public callback URL, example `https://gmail-assistant-api.onrender.com/api/auth/callback`.
- `GMAIL_POST_AUTH_REDIRECT_URL`: URL to send user back to after auth, example `https://chimerical-creponne-ae8827.netlify.app/gmail-assistant`.

Optional:

- `GOOGLE_CLIENT_SECRETS_PATH`: Path to a JSON secret file (used instead of `GOOGLE_CLIENT_SECRET_JSON` when set).
- `USE_OLLAMA_AI`: `true` or `false` (default `false`).

## Render Deploy

This folder includes `render.yaml`.

1. Create a new Render Web Service from this repository.
2. Confirm `rootDir` is `gmail-assistant-backend`.
3. Set the environment variables listed above.
4. Deploy.

## Google Cloud OAuth Setup

In Google Cloud Console, edit your OAuth client and add the exact redirect URI:

- `https://YOUR-RENDER-HOST/api/auth/callback`

Use the same URI value in `GMAIL_OAUTH_REDIRECT_URI`.

## Netlify Integration

In your Netlify site env vars, set:

- `GMAIL_ASSISTANT_API_BASE_URL` = your Render backend base URL (no trailing slash required)

Then redeploy Netlify.
