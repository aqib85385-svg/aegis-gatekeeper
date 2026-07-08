import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applySecurityHeaders } from './security.js';
import { formatError } from './errorHelper.js';
import { metricsContainer } from './metricsCounter.js';
import { processDecision } from './decisionCore.js';
import { applyRateLimitGuard } from './rateLimitGuard.js';
import { logger } from './logger.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  metricsContainer.decisionProxyRequests++;
  logger.info('incoming_request_method', req.method);

  // Enable CORS
  const origin = (req.headers?.origin || '') as string;
  const isAllowedOrigin = 
    origin.startsWith('http://localhost:') ||
    origin.startsWith('http://127.0.0.1:') ||
    origin.endsWith('.run.app') ||
    origin.endsWith('.vercel.app');

  if (origin && isAllowedOrigin) {
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', origin);
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // HTTP Security Headers
  applySecurityHeaders(res);

  if (req.method === 'OPTIONS') {
    logger.info('cors_preflight_options');
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    logger.info('method_not_allowed', req.method);
    return res.status(405).json(formatError('Method not allowed'));
  }

  const ip = ((req.headers?.['x-forwarded-for'] || req.headers?.['x-real-ip'] || '127.0.0.1') as string).toString().split(',')[0].trim();
  const limitGuard = applyRateLimitGuard(ip);
  if (limitGuard) {
    res.setHeader('Retry-After', limitGuard.retryAfterSeconds.toString());
    return res.status(limitGuard.status).json(limitGuard.body);
  }

  const result = await processDecision(req.body, 'Vercel serverless function');
  return res.status(result.status).json(result.data);
}
