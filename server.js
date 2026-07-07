import './scripts/verify-env.js';
import express from 'express';
import compression from 'compression';
import path from 'path';
import { fileURLToPath } from 'url';
import { applySecurityHeaders, applyFallbackSecurityHeaders } from './api/security.js';
import { formatError } from './api/errorHelper.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import { processDecision } from './api/decisionCore.js';

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

// 2. Upstream Gemini API System Prompt
const SYSTEM_PROMPT = `
You are the Aegis GateKeeper Decision Engine for the FIFA World Cup 2026.
Your role is to analyze a gate access incident (provided via image and/or text context) and output a structured operational decision for gate volunteers.

Stricly evaluate the incident against the following guidelines:
1. SECURITY & BAGGAGE LIMITS:
   - Clear bags only, max dimensions 12x6x12 inches.
   - EXEMPTIONS: Childcare bags (diaper bags) and medical bags are permitted but must be physically inspected and tagged (Yellow 'REVIEW' status).
   - Items: Metal flasks/bottles must be emptied before admission. Baby formula, milk, and medical items are permitted.
   - Equipment: Professional cameras (lenses > 150mm/6in or requiring a tripod) are prohibited. Amateur cameras are allowed.
   
2. TICKETING COMPLIANCE:
   - Dynamic QR codes/NFC tickets are mandatory.
   - Screenshots of tickets (static images) are strictly PROHIBITED to prevent duplication fraud (Red 'DENY' status). Refer them to the Ticket Resolution Window.
   - Dead phone batteries must be referred to the Ticket Resolution Window (Gate A/Customer Service).

3. DYNAMIC GATE FLOW ROUTING:
   - Default: Fans must enter at their assigned gate.
   - EXEMPTION: If the current queue wait time exceeds 15 minutes AND time-to-kickoff is less than 30 minutes, you are authorized to redirect the fan to an adjacent gate (e.g. Gate D instead of Gate C) to prevent crowd build-up.

You must output a JSON object containing exactly the following keys. No markdown blocks, no extra text, just raw JSON:
{
  "status": "ALLOW" | "REVIEW" | "DENY",
  "action": "A clear, bold operational instruction for the volunteer (max 10 words).",
  "explanation": "A concise step-by-step logic explanation citing which rules applied.",
  "translation": "A polite, direct Spanish translation of the instruction for the fan."
}
`;

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
