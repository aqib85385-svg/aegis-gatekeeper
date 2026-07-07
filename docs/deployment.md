# Deployment Guide

Aegis GateKeeper is compatible with Vercel and Google Cloud Run environments.

## Option A: Vercel Serverless
1. Install Vercel CLI: `npm install -g vercel`.
2. Configure project variables: bind `GEMINI_API_KEY` on your project dashboard.
3. Deploy to production: `vercel --prod`.

## Option B: Google Cloud Run Container
1. Create a secret in Google Secret Manager to securely store your `GEMINI_API_KEY`:
   ```bash
   gcloud secrets create GEMINI_API_KEY
   # Add your key version
   echo -n "YOUR_API_KEY" | gcloud secrets versions add GEMINI_API_KEY --data-file=-
   ```
2. Build and deploy the container to Cloud Run, mounting the secret and configuring a warm instance to preserve the in-memory cache and prevent cold-start latency:
   ```bash
   gcloud run deploy aegis-gatekeeper --source . --region us-central1 --allow-unauthenticated --set-secrets GEMINI_API_KEY=GEMINI_API_KEY:latest --min-instances=1
   ```
