import { formatError } from './errorHelper.js';
import { buildPromptParts } from './promptBuilder.js';

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
    if (entry && now - entry.timestamp < CACHE_TTL_MS) {
      console.log('[INFO] Cache hit for key:', key);
      return entry.response;
    } else {
      console.log('[INFO] Cache expired for key:', key);
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
  console.log('[INFO] Cache set for key:', key);
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



export async function processDecision(body, platformName) {
  const { image, text, telemetry } = body || {};

  const cachedResponse = getCachedResponse(image, text, telemetry);
  if (cachedResponse) {
    return { status: 200, data: cachedResponse };
  }

  // Base64 payload structure checks to prevent malformed requests
  if (image && (typeof image !== 'string' || image.trim() === '' || !/^[A-Za-z0-9+/=]+$/.test(image.replace(/\s/g, '')))) {
    console.error('[ERROR] Invalid image format. Rejecting request 400.');
    return {
      status: 400,
      data: formatError('Invalid image format: Must be a valid Base64 payload.')
    };
  }

  const apiKey = process.env.GEMINI_API_KEY;
  console.log('[INFO] Verification: process.env.GEMINI_API_KEY status:', {
    exists: !!apiKey,
    length: apiKey ? apiKey.length : 0
  });

  if (!apiKey) {
    console.error('[ERROR] [Line 49] Missing GEMINI_API_KEY environment variable. Early return 500.');
    return {
      status: 500,
      data: formatError(
        `API Key not configured on ${platformName}.`,
        'Environment variable GEMINI_API_KEY is undefined or empty.'
      )
    };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000); // 10-second timeout

  try {
    const parts = buildPromptParts(text, telemetry, image);

    const geminiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';
    console.log('[INFO] Fetching Gemini API url:', geminiUrl);

    let response = await fetch(geminiUrl, {
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

    if (response.status >= 500) {
      console.warn('[WARN] Transient Gemini upstream error, status:', response.status, '. Retrying once...');
      response = await fetch(geminiUrl, {
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
    }

    clearTimeout(timeoutId);

    console.log('[INFO] Gemini upstream response status:', response.status, 'ok:', response.ok);

    if (!response.ok) {
      const errText = await response.text();
      console.error('[ERROR] [Line 85] Upstream Gemini API error:', errText);
      return {
        status: response.status,
        data: formatError(
          'Upstream model service error',
          `Upstream returned status ${response.status}: ${errText}`
        )
      };
    }

    const result = await response.json();
    console.log('[INFO] Gemini response JSON parsed successfully.');

    const modelText = result.candidates?.[0]?.content?.parts?.[0]?.text;
    console.log('[INFO] Extracted candidate modelText:', modelText ? modelText.substring(0, 100) + '...' : 'undefined');

    if (!modelText) {
      console.error('[ERROR] [Line 94] Empty response from model candidate.');
      throw new Error('Empty response from model candidate');
    }

    const decisionData = JSON.parse(modelText.trim());
    console.log('[INFO] Final parsed decision structure:', decisionData);
    setCachedResponse(image, text, telemetry, decisionData);
    return { status: 200, data: decisionData };
  } catch (error) {
    if (typeof timeoutId !== 'undefined') {
      clearTimeout(timeoutId);
    }
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : '';
    console.error('[ERROR] [Catch Block] Thrown exception caught:', errorMessage, errorStack);
    return {
      status: 500,
      data: formatError(
        'Failed to process decision request: ' + errorMessage,
        errorMessage,
        errorStack
      )
    };
  }
}
