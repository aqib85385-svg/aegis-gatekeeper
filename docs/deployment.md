# Deployment Guide

Aegis GateKeeper is compatible with Vercel and Google Cloud Run environments.

## Option A: Vercel Serverless
1. Install Vercel CLI: `npm install -g vercel`.
2. Configure project variables: bind `GEMINI_API_KEY` on your project dashboard.
3. Deploy to production: `vercel --prod`.

## Option B: Google Cloud Run Container
1. Build and push the container to Cloud Run using Google Cloud SDK:
   ```bash
   gcloud run deploy aegis-gatekeeper --source . --region us-central1 --allow-unauthenticated
   ```
