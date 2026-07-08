import './scripts/verify-env.js';
import express from 'express';
import compression from 'compression';
import path from 'path';
import { fileURLToPath } from 'url';
import { applySecurityHeaders, applyFallbackSecurityHeaders } from './api/security.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import { processDecision } from './api/decisionCore.js';
import { applyRateLimitGuard } from './api/rateLimitGuard.js';

let decisionProxyRequestCount = 0;

const app = express();

app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) {
    applySecurityHeaders(res);
  } else {
    applyFallbackSecurityHeaders(res);
  }
  next();
});

app.use(compression());
app.use(express.json({ limit: '10mb' }));

// 1. Serves static production assets compiled by Vite
app.use(express.static(path.join(__dirname, 'dist'), {
  setHeaders: (res, filePath) => {
    if (/[\\/]assets[\\/]/.test(filePath)) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }
  }
}));



app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

app.get('/api/metrics', (req, res) => {
  res.status(200).json({
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    decisionProxyRequests: decisionProxyRequestCount,
    scope: 'process'
  });
});

app.post('/api/decision-proxy', async (req, res) => {
  decisionProxyRequestCount++;
  
  const ip = (req.headers?.['x-forwarded-for'] || req.ip || '127.0.0.1').toString().split(',')[0].trim();
  const limitGuard = applyRateLimitGuard(ip);
  
  if (limitGuard) {
    res.setHeader('Retry-After', limitGuard.retryAfterSeconds.toString());
    return res.status(limitGuard.status).json(limitGuard.body);
  }
  
  const result = await processDecision(req.body, 'Google Cloud Run server');
  return res.status(result.status).json(result.data);
});

app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log(`Aegis GateKeeper running on port ${port}`);
});
