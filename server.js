import './scripts/verify-env.js';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { applySecurityHeaders, applyFallbackSecurityHeaders } from './api/security.js';
import { formatError } from './api/errorHelper.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// In-memory request cache
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const requestCache = new Map();

function hashString(str) {
  if (!str) return 'empty';
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return hash.toString(16);
}

function getCachedResponse(image, text, telemetry) {
  const imageHash = hashString(image);
  const textHash = hashString(text);
  const key = `${textHash}:${imageHash}:${telemetry?.queueMinutes ?? 0}:${telemetry?.timeToKickoff ?? 0}`;
  
  const now = Date.now();
  if (requestCache.has(key)) {
    const entry = requestCache.get(key);
    if (now - entry.timestamp < CACHE_TTL_MS) {
      console.log('[DEBUG] Cache hit for key:', key);
      return entry.response;
    } else {
      console.log('[DEBUG] Cache expired for key:', key);
      requestCache.delete(key);
    }
  }
  return null;
}

function setCachedResponse(image, text, telemetry, response) {
  const imageHash = hashString(image);
  const textHash = hashString(text);
  const key = `${textHash}:${imageHash}:${telemetry?.queueMinutes ?? 0}:${telemetry?.timeToKickoff ?? 0}`;
  
  if (requestCache.size >= 500) {
    const firstKey = requestCache.keys().next().value;
    if (firstKey) requestCache.delete(firstKey);
  }
  
  requestCache.set(key, {
    response,
    timestamp: Date.now()
  });
  console.log('[DEBUG] Cache set for key:', key);
}

// Expired entries cleanup timer
if (typeof setInterval !== 'undefined') {
  const interval = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of requestCache.entries()) {
      if (now - entry.timestamp >= CACHE_TTL_MS) {
        requestCache.delete(key);
      }
    }
  }, 60000);
  if (interval && typeof interval.unref === 'function') {
    interval.unref();
  }
}

const app = express();
app.use(express.json({ limit: '10mb' }));

// 1. Serves static production assets compiled by Vite
app.use(express.static(path.join(__dirname, 'dist')));

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

app.post('/api/decision-proxy', async (req, res) => {
  console.log('[DEBUG] Incoming Request Method:', req.method);

  // Set HTTP security headers
  applySecurityHeaders(res);
  
  const { image, text, telemetry } = req.body;
  console.log('[DEBUG] Request Payload parsed:', {
    hasImage: !!image,
    textLength: text?.length ?? 0,
    telemetry
  });

  const cachedResponse = getCachedResponse(image, text, telemetry);
  if (cachedResponse) {
    return res.status(200).json(cachedResponse);
  }

  // Base64 payload structure checks to prevent malformed requests
  if (image && (typeof image !== 'string' || image.trim() === '' || !/^[A-Za-z0-9+/=]+$/.test(image.replace(/\s/g, '')))) {
    console.error('[DEBUG] Invalid image format. Rejecting request 400.');
    return res.status(400).json(formatError('Invalid image format: Must be a valid Base64 payload.'));
  }

  const apiKey = process.env.GEMINI_API_KEY;
  console.log('[DEBUG] Verification: process.env.GEMINI_API_KEY status:', {
    exists: !!apiKey,
    length: apiKey ? apiKey.length : 0
  });

  if (!apiKey) {
    console.error('[DEBUG] [Line 49] Missing GEMINI_API_KEY environment variable. Early return 500.');
    return res.status(500).json(formatError(
      'API Key not configured on Google Cloud Run server.',
      'Environment variable GEMINI_API_KEY is undefined or empty.'
    ));
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000); // 10-second timeout

  try {
    const parts = [
      {
        text: `${SYSTEM_PROMPT}\n\nVOLUNTEER DESCRIPTION: "${text || 'No description provided.'}"\n\nTELEMETRY:\n- Current Queue Wait Time: ${telemetry?.queueMinutes ?? 0} minutes\n- Time to Kickoff: ${telemetry?.timeToKickoff ?? 60} minutes`
      }
    ];

    if (image) {
      parts.push({
        inlineData: {
          mimeType: 'image/jpeg',
          data: image
        }
      });
    }

    const geminiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';
    console.log('[DEBUG] Fetching Gemini API url:', geminiUrl);

    const response = await fetch(geminiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey
      },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: {
          responseMimeType: 'application/json'
        }
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    console.log('[DEBUG] Gemini upstream response status:', response.status, 'ok:', response.ok);

    if (!response.ok) {
      const errText = await response.text();
      console.error('[DEBUG] [Line 85] Upstream Gemini API error:', errText);
      return res.status(response.status).json(formatError(
        'Upstream model service error',
        `Upstream returned status ${response.status}: ${errText}`
      ));
    }

    const result = await response.json();
    console.log('[DEBUG] Gemini response JSON parsed successfully.');

    const modelText = result.candidates?.[0]?.content?.parts?.[0]?.text;
    console.log('[DEBUG] Extracted candidate modelText:', modelText ? modelText.substring(0, 100) + '...' : 'undefined');

    if (!modelText) {
      console.error('[DEBUG] [Line 94] Empty response from model candidate.');
      throw new Error('Empty response from model candidate');
    }

    const decisionData = JSON.parse(modelText.trim());
    console.log('[DEBUG] Final parsed decision structure:', decisionData);
    setCachedResponse(image, text, telemetry, decisionData);
    return res.status(200).json(decisionData);
  } catch (error) {
    // If the timeout is defined, clear it to avoid resource leaks
    if (typeof timeoutId !== 'undefined') {
      clearTimeout(timeoutId);
    }
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : '';
    console.error('[DEBUG] [Catch Block] Thrown exception caught:', errorMessage, errorStack);
    return res.status(500).json(formatError(
      'Failed to process decision request: ' + errorMessage,
      errorMessage,
      errorStack
    ));
  }
});

app.use((req, res) => {
  applyFallbackSecurityHeaders(res);
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log(`Aegis GateKeeper running on port ${port}`);
});
