import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applySecurityHeaders } from './security.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  applySecurityHeaders(res);
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  return res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
}
