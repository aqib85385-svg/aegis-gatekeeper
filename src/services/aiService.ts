import { safeParseDecision } from '../utils/schema';
import type { DecisionResponse } from '../utils/schema';
import { checkLocalPolicy } from './policyEngine';
import { evaluateBaggage } from './decisionEngine';

interface TelemetryData {
  queueMinutes: number;
  timeToKickoff: number;
}

/**
 * Service to manage communication with the secure backend API proxy,
 * including client-side fallback engines.
 */
class AiService {
  private useMockFallback: boolean = false;

  /**
   * Toggles the service to run in full local mock simulation mode (no API calls).
   */
  public setMockMode(enabled: boolean): void {
    this.useMockFallback = enabled;
  }

  /**
   * Converts a Blob file into a base64 encoded string for data transfer.
   */
  private blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result;
        if (typeof result !== 'string') {
          reject(new Error('FileReader result is not a valid string.'));
          return;
        }
        // Strip the data:image/*;base64, prefix
        const base64Data = result.split(',')[1] || '';
        resolve(base64Data);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  /**
   * Main gate incident analysis pipeline.
   * Runs local safety keyword engine, and if no hit, queries the secure Vercel API proxy.
   * Automatically falls back to high-quality local mock resolution on network errors.
   */
  public async analyzeGateIncident(
    imageBlob: Blob | null,
    volunteerText: string,
    telemetry: TelemetryData
  ): Promise<DecisionResponse> {
    // 1. Run local policy checks first (deterministic bypass for security/medical terms)
    const policyResult = checkLocalPolicy(volunteerText);
    if (policyResult) {
      console.log('Policy bypass hit:', policyResult);
      return policyResult;
    }

    // Call evaluateBaggage() first to get the deterministic status/action/reason
    const deterministic = evaluateBaggage(volunteerText, telemetry);

    // 2. Direct request to simulation mock engine if enabled
    if (this.useMockFallback) {
      return this.generateMockResponse(volunteerText, telemetry);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8-second timeout

    try {
      // Prepare payload properties
      let imageBase64 = '';
      if (imageBlob) {
        imageBase64 = await this.blobToBase64(imageBlob);
      }

      // Prepend the pre-determined outcome as context to guide the LLM's explanation/translation
      const contextText = `[PRE-DETERMINED DECISION: ${deterministic.status}, REQUIRED ACTION: ${deterministic.action}] ${volunteerText}`;

      // 3. Post to the secure Vercel API endpoint
      const response = await fetch('/api/decision-proxy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          image: imageBase64,
          text: contextText,
          telemetry
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`API returned status ${response.status}`);
      }

      const json = await response.json();
      
      // 4. Validate output shape using strict Zod parser contract
      const validated = safeParseDecision(json);

      // If schema validation failed and returned the safety fallback, preserve it
      if (validated.action === 'Manual Review Needed') {
        return validated;
      }

      // If a specific deterministic rule was matched, override the LLM response.
      // This enforces safety constraints for known operational guidelines (e.g., flask presence).
      if (deterministic.action !== 'APPROVE FOR STANDARD ENTRY') {
        return {
          ...validated,
          status: deterministic.status,
          action: deterministic.action
        };
      }

      // [Option B: Intentional LLM Autonomy for Unmatched Cases]
      // If no deterministic rule fired, we allow the validated LLM response to stand.
      // This is intentional and safe: the LLM functions as a general-purpose semantic classifier
      // to identify other complex or unmodeled issues (e.g., verifying custom tickets, general questions,
      // or detecting safety/policy violations not represented in simple keyword lists) that require
      // flexibility beyond hardcoded bypass rules.
      return validated;
    } catch (error) {
      clearTimeout(timeoutId);
      console.warn('Backend proxy lookup failed, dropping back to local AI fallback:', error);
      // 5. Safe recovery: trigger mock fallback to prevent gate blockage
      return this.generateMockResponse(volunteerText, telemetry);
    }
  }

  /**
   * Simulates high-quality, local decision reasoning when offline or key-less.
   * Matches core dynamic problem profiles.
   */
  public generateMockResponse(text: string, telemetry: TelemetryData): DecisionResponse {
    const decision = evaluateBaggage(text, telemetry);

    // Get corresponding Spanish translation
    let translation = 'Puede pasar. Disfrute del partido.';
    switch (decision.action) {
      case 'REDIRECT TO GATE D':
        translation = 'Por favor, diríjase a la Puerta D. Hay menos de 2 minutos de espera.';
        break;
      case 'PROCEED TO TURNSTILE':
        translation = 'Adelante por los molinetes.';
        break;
      case 'EMPTY FLASK & TAG DIAPER BAG':
        translation = 'Vacíe el termo de metal. Su bolso de bebé está aprobado.';
        break;
      case 'APPLY GREEN TAG & ADMIT':
        translation = 'Su bolso de bebé está aprobado para ingresar.';
        break;
      case 'SHOW SECTOR 200 MAP':
        translation = 'Suba por las escaleras mecánicas del sector 200, están a la derecha.';
        break;
      case 'SEND TO TICKET RESOLUTION':
        translation = 'No se aceptan capturas de pantalla. Vaya a la taquilla de resolución de tickets.';
        break;
      case 'APPROVE FOR STANDARD ENTRY':
      default:
        translation = 'Puede pasar. Disfrute del partido.';
        break;
    }

    return {
      status: decision.status,
      action: decision.action,
      explanation: decision.reason,
      translation
    };
  }
}

export const aiService = new AiService();
export default aiService;
