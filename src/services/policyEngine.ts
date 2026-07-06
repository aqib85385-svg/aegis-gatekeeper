import type { DecisionResponse } from '../utils/schema';

// List of strict safety keywords and their deterministic responses
const SECURITY_KEYWORDS = ['weapon', 'gun', 'knife', 'bomb', 'fire', 'smoke', 'threat', 'fight'];
const MEDICAL_KEYWORDS = ['medical', 'heart', 'insulin', 'stroke', 'seizure', 'collapse', 'crush', 'bleed', 'injury'];

/**
 * Checks incoming reports for critical keywords to bypass GenAI processing.
 * This guarantees zero-latency deterministic routing for emergency scenarios.
 * Returns a DecisionResponse if a policy match is hit, otherwise null.
 */
export function checkLocalPolicy(text: string): DecisionResponse | null {
  const normalized = text.toLowerCase().trim();

  // Test for security threats
  for (const keyword of SECURITY_KEYWORDS) {
    if (normalized.includes(keyword)) {
      return {
        status: 'DENY',
        action: 'ALERT SECURITY IMMEDIATELY',
        explanation: `Deterministic security threat triggered locally due to high-risk keyword: "${keyword}".`,
        translation: 'Seguridad ha sido notificada. Por favor, permanezca en su lugar.'
      };
    }
  }

  // Test for medical emergencies
  for (const keyword of MEDICAL_KEYWORDS) {
    if (normalized.includes(keyword)) {
      return {
        status: 'REVIEW',
        action: 'CALL MEDICAL RESPONDERS',
        explanation: `Deterministic medical safety trigger activated locally due to keyword: "${keyword}".`,
        translation: 'Se ha solicitado asistencia médica. Por favor, espere aquí.'
      };
    }
  }

  return null;
}
