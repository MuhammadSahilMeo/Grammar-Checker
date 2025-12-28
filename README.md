# AI Grammar Pro

A professional AI-powered grammar checker using Google's Gemini API.

## Vercel Deployment

This app uses Vercel Serverless Functions to securely handle API calls.

### Setup:

1. Deploy to Vercel (or push to your connected repo)
2. Add environment variable in Vercel dashboard:
   - Go to Settings → Environment Variables
   - Add: `GEMINI_API_KEY` with your API key value
3. Redeploy if needed

## Security

The API key is securely stored as an environment variable and only accessible by the serverless function, not the client.