import type { VercelRequest, VercelResponse } from '@vercel/node';

// System prompt instructing Gemini to behave as the Aegis GateKeeper Decision Engine
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
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

  if (req.method === 'OPTIONS') {
    console.log('[DEBUG] CORS Preflight OPTIONS Request detected. Returning 200.');
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    console.log(`[DEBUG] Method ${req.method} not allowed. Early return 405.`);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { image, text, telemetry } = req.body;
  console.log('[DEBUG] Request Payload parsed:', {
    hasImage: !!image,
    textLength: text?.length ?? 0,
    telemetry
  });

  const apiKey = process.env.GEMINI_API_KEY;
  console.log('[DEBUG] Verification: process.env.GEMINI_API_KEY status:', {
    exists: !!apiKey,
    length: apiKey ? apiKey.length : 0
  });

  if (!apiKey) {
    console.error('[DEBUG] [Line 54] Missing GEMINI_API_KEY environment variable. Early return 500.');
    return res.status(500).json({ 
      error: 'API Key not configured on host server.', 
      exception: 'Environment variable GEMINI_API_KEY is undefined or empty.' 
    });
  }

  try {
    const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [
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

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    console.log('[DEBUG] Fetching Gemini API url:', `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=REDACTED_${apiKey.length}`);

    const response = await fetch(geminiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: {
          responseMimeType: 'application/json'
        }
      })
    });

    console.log('[DEBUG] Gemini upstream response status:', response.status, 'ok:', response.ok);

    if (!response.ok) {
      const errText = await response.text();
      console.error('[DEBUG] [Line 92] Upstream Gemini API error:', errText);
      return res.status(response.status).json({ 
        error: 'Upstream model service error',
        exception: `Upstream returned status ${response.status}: ${errText}`
      });
    }

    const result = await response.json();
    console.log('[DEBUG] Gemini response JSON parsed successfully.');

    const modelText = result.candidates?.[0]?.content?.parts?.[0]?.text;
    console.log('[DEBUG] Extracted candidate modelText:', modelText ? modelText.substring(0, 100) + '...' : 'undefined');

    if (!modelText) {
      console.error('[DEBUG] [Line 101] Empty response from model candidate.');
      throw new Error('Empty response from model candidate');
    }

    const decisionData = JSON.parse(modelText.trim());
    console.log('[DEBUG] Final parsed decision structure:', decisionData);
    return res.status(200).json(decisionData);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : '';
    console.error('[DEBUG] [Catch Block] Thrown exception caught:', errorMessage, errorStack);
    return res.status(500).json({ 
      error: 'Failed to process decision request: ' + errorMessage,
      exception: errorMessage,
      stack: errorStack
    });
  }
}
