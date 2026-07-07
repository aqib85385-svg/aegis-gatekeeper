import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applySecurityHeaders } from './security.js';
import { formatError } from './errorHelper.js';
import { metricsContainer } from './metricsCounter.js';
import { processDecision } from './decisionCore.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  metricsContainer.decisionProxyRequests++;
  console.log('[DEBUG] Incoming Request Method:', req.method);

  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  const origin = (req.headers?.origin || '') as string;
  const isAllowedOrigin = 
    origin.startsWith('http://localhost:') ||
    origin.startsWith('http://127.0.0.1:') ||
    origin.endsWith('.run.app') ||
    origin.endsWith('.vercel.app') ||
    origin === '';
  res.setHeader('Access-Control-Allow-Origin', (isAllowedOrigin && origin) ? origin : '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // HTTP Security Headers
  applySecurityHeaders(res);

  if (req.method === 'OPTIONS') {
    console.log('[DEBUG] CORS Preflight OPTIONS Request detected. Returning 200.');
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    console.log(`[DEBUG] Method ${req.method} not allowed. Early return 405.`);
    return res.status(405).json(formatError('Method not allowed'));
  }

  const result = await processDecision(req.body, 'Vercel serverless function');
  return res.status(result.status).json(result.data);
}
