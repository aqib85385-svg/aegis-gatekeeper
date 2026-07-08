import { describe, it, expect } from 'vitest';
import { buildPromptParts } from '../../api/promptBuilder.js';

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

describe('buildPromptParts tests', () => {
  it('should construct prompt parts correctly without image and with empty parameters', () => {
    const parts = buildPromptParts(undefined, undefined, undefined);
    expect(parts).toHaveLength(1);
    expect(parts[0]).toHaveProperty('text');
    
    const expectedText = `${SYSTEM_PROMPT}\n\nVOLUNTEER DESCRIPTION: "No description provided."\n\nTELEMETRY:\n- Current Queue Wait Time: 0 minutes\n- Time to Kickoff: 60 minutes`;
    expect(parts[0].text).toBe(expectedText);
  });

  it('should construct prompt parts correctly with description and custom telemetry, without image', () => {
    const text = 'Fan arrived at the gate with a suspicious clear backpack.';
    const telemetry = { queueMinutes: 10, timeToKickoff: 25 };
    const parts = buildPromptParts(text, telemetry, undefined);
    
    expect(parts).toHaveLength(1);
    const expectedText = `${SYSTEM_PROMPT}\n\nVOLUNTEER DESCRIPTION: "${text}"\n\nTELEMETRY:\n- Current Queue Wait Time: 10 minutes\n- Time to Kickoff: 25 minutes`;
    expect(parts[0].text).toBe(expectedText);
  });

  it('should construct prompt parts correctly when an image is provided', () => {
    const text = 'Ticket screenshot presentation';
    const telemetry = { queueMinutes: 5, timeToKickoff: 45 };
    const imageBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
    const parts = buildPromptParts(text, telemetry, imageBase64);
    
    expect(parts).toHaveLength(2);
    
    // First part: system prompt, description, telemetry
    const expectedText = `${SYSTEM_PROMPT}\n\nVOLUNTEER DESCRIPTION: "${text}"\n\nTELEMETRY:\n- Current Queue Wait Time: 5 minutes\n- Time to Kickoff: 45 minutes`;
    expect(parts[0].text).toBe(expectedText);
    
    // Second part: image data block
    expect(parts[1]).toHaveProperty('inlineData');
    expect(parts[1].inlineData).toEqual({
      mimeType: 'image/jpeg',
      data: imageBase64
    });
  });
});
