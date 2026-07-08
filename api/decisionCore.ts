import { formatError, type FormattedError } from './errorHelper.js';
import { buildPromptParts, type TelemetryData, type GeminiPart } from './promptBuilder.js';
import { logger } from './logger.js';

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export interface DecisionResponse {
  status: 'ALLOW' | 'REVIEW' | 'DENY';
  action: string;
  explanation: string;
  translation: string;
}

interface CacheEntry {
  response: DecisionResponse;
  timestamp: number;
}

const requestCache = new Map<string, CacheEntry>();

export interface DecisionRequestBody {
  image?: string;
  text?: string;
  telemetry?: TelemetryData;
}

export interface ProcessDecisionResult {
  status: number;
  data: DecisionResponse | FormattedError;
}

function hashString(str: string | undefined): string {
  if (!str) return 'empty';
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return hash.toString(16);
}

function getCachedResponse(
  image: string | undefined,
  text: string | undefined,
  telemetry: TelemetryData | undefined
): DecisionResponse | null {
  const imageHash = hashString(image);
  const textHash = hashString(text);
  const key = `${textHash}:${imageHash}:${telemetry?.queueMinutes ?? 0}:${telemetry?.timeToKickoff ?? 0}`;
  
  const now = Date.now();
  if (requestCache.has(key)) {
    const entry = requestCache.get(key);
    if (entry && now - entry.timestamp < CACHE_TTL_MS) {
      logger.info('cache_hit', key);
      return entry.response;
    } else {
      logger.info('cache_expired', key);
      requestCache.delete(key);
    }
  }
  return null;
}

function setCachedResponse(
  image: string | undefined,
  text: string | undefined,
  telemetry: TelemetryData | undefined,
  response: DecisionResponse
): void {
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
  logger.info('cache_set', key);
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

interface GeminiCandidate {
  content?: {
    parts?: Array<{
      text?: string;
    }>;
  };
}

interface GeminiApiResponse {
  candidates?: GeminiCandidate[];
}

async function fetchGeminiOnce(
  url: string,
  apiKey: string,
  parts: GeminiPart[],
  signal: AbortSignal
): Promise<Response> {
  return fetch(url, {
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
    signal
  });
}

type ValidationResult =
  | { success: true; apiKey: string }
  | { success: false; error: ProcessDecisionResult };

function validateRequest(
  image: string | undefined,
  platformName: string
): ValidationResult {
  // Base64 payload structure checks to prevent malformed requests
  if (image && (typeof image !== 'string' || image.trim() === '' || !/^[A-Za-z0-9+/=]+$/.test(image.replace(/\s/g, '')))) {
    logger.error('invalid_image_format');
    return {
      success: false,
      error: {
        status: 400,
        data: formatError('Invalid image format: Must be a valid Base64 payload.')
      }
    };
  }

  const apiKey = process.env.GEMINI_API_KEY;
  logger.info('api_key_status', {
    exists: !!apiKey,
    length: apiKey ? apiKey.length : 0
  });

  if (!apiKey) {
    logger.error('missing_api_key');
    return {
      success: false,
      error: {
        status: 500,
        data: formatError(
          `API Key not configured on ${platformName}.`,
          'Environment variable GEMINI_API_KEY is undefined or empty.'
        )
      }
    };
  }

  return { success: true, apiKey };
}

async function fetchDecisionFromGemini(
  url: string,
  apiKey: string,
  parts: GeminiPart[],
  signal: AbortSignal
): Promise<Response> {
  let response = await fetchGeminiOnce(url, apiKey, parts, signal);

  if (response.status >= 500) {
    logger.warn('transient_upstream_error', response.status);
    response = await fetchGeminiOnce(url, apiKey, parts, signal);
  }

  return response;
}

async function parseGeminiResponse(
  response: Response,
  image: string | undefined,
  text: string | undefined,
  telemetry: TelemetryData | undefined
): Promise<ProcessDecisionResult> {
  if (!response.ok) {
    const errText = await response.text();
    logger.error('upstream_api_error', errText);
    return {
      status: response.status,
      data: formatError(
        'Upstream model service error',
        `Upstream returned status ${response.status}: ${errText}`
      )
    };
  }

  const result = (await response.json()) as GeminiApiResponse;
  logger.info('json_parsed_successfully');

  const modelText = result.candidates?.[0]?.content?.parts?.[0]?.text;
  logger.info('extracted_model_text', modelText ? modelText.substring(0, 100) + '...' : 'undefined');

  if (!modelText) {
    logger.error('empty_model_response');
    throw new Error('Empty response from model candidate');
  }

  const decisionData = JSON.parse(modelText.trim()) as DecisionResponse;
  logger.info('decision_parsed', { status: decisionData.status });
  setCachedResponse(image, text, telemetry, decisionData);
  return { status: 200, data: decisionData };
}

export async function processDecision(
  body: DecisionRequestBody | undefined,
  platformName: string
): Promise<ProcessDecisionResult> {
  const { image, text, telemetry } = body || {};

  // 1. Cache lookup
  const cachedResponse = getCachedResponse(image, text, telemetry);
  if (cachedResponse) {
    return { status: 200, data: cachedResponse };
  }

  // 2-3. Input validation & API key check
  const validation = validateRequest(image, platformName);
  if (!validation.success) {
    return validation.error;
  }

  // 4. AbortController + 10s timeout created
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000); // 10-second timeout

  try {
    const parts = buildPromptParts(text, telemetry, image);
    const geminiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';
    logger.info('fetching_gemini_url', geminiUrl);

    // 5. Fetch decision
    const response = await fetchDecisionFromGemini(geminiUrl, validation.apiKey, parts, controller.signal);

    // 6. clearTimeout immediately after response received (success path)
    clearTimeout(timeoutId);

    // 7-9. Parse response, extract modelText, set cache, return 200
    return await parseGeminiResponse(response, image, text, telemetry);
  } catch (error) {
    // 10. catch block - clearTimeout again (defensive) and return 500
    if (typeof timeoutId !== 'undefined') {
      clearTimeout(timeoutId);
    }
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : '';
    logger.error('exception_caught', errorMessage, errorStack);
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
