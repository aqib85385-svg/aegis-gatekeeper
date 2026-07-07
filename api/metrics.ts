import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applySecurityHeaders } from './security.js';
import { metricsContainer } from './metricsCounter.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  applySecurityHeaders(res);
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  // Serverless instances do not share memory; counter resets per cold start. Global metrics require an external store.
  return res.status(200).json({
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    decisionProxyRequestsThisInstance: metricsContainer.decisionProxyRequests,
    scope: 'per-instance'
  });
}
