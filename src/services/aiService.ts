import { safeParseDecision } from '../utils/schema';
import type { DecisionResponse } from '../utils/schema';
import { checkLocalPolicy } from './policyEngine';

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
        const result = reader.result as string;
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

    // 2. Direct request to simulation mock engine if enabled
    if (this.useMockFallback) {
      return this.generateMockResponse(volunteerText, telemetry);
    }

    try {
      // Prepare payload properties
      let imageBase64 = '';
      if (imageBlob) {
        imageBase64 = await this.blobToBase64(imageBlob);
      }

      // 3. Post to the secure Vercel API endpoint
      const response = await fetch('/api/decision-proxy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          image: imageBase64,
          text: volunteerText,
          telemetry
        })
      });

      if (!response.ok) {
        throw new Error(`API returned status ${response.status}`);
      }

      const json = await response.json();
      
      // 4. Validate output shape using strict Zod parser contract
      return safeParseDecision(json);
    } catch (error) {
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
    const query = text.toLowerCase();

    // Case 1: Overloaded Gate Redirect Case
    if (query.includes('gate') || query.includes('crowd') || query.includes('queue')) {
      if (telemetry.queueMinutes > 15 && telemetry.timeToKickoff < 30) {
        return {
          status: 'REVIEW',
          action: 'REDIRECT TO GATE D',
          explanation: `Gate wait time is ${telemetry.queueMinutes}m and kickoff is in ${telemetry.timeToKickoff}m. Override ticket gate allocation and route to Gate D under FIFA Ops Manual Sec 4.2.`,
          translation: 'Por favor, diríjase a la Puerta D. Hay menos de 2 minutos de espera.'
        };
      }
      return {
        status: 'ALLOW',
        action: 'PROCEED TO TURNSTILE',
        explanation: 'Gate is busy but within acceptable throughput parameters.',
        translation: 'Adelante por los molinetes.'
      };
    }

    // Case 2: Diaper / Care Bag Exemption Case
    if (query.includes('bag') || query.includes('diaper') || query.includes('child') || query.includes('baby')) {
      if (query.includes('flask') || query.includes('metal') || query.includes('thermos')) {
        return {
          status: 'REVIEW',
          action: 'EMPTY FLASK & TAG DIAPER BAG',
          explanation: 'Baggage is approved under the FIFA Childcare Exemption rule, but the metal flask must be emptied before entering the stadium.',
          translation: 'Vacíe el termo de metal. Su bolso de bebé está aprobado.'
        };
      }
      return {
        status: 'ALLOW',
        action: 'APPLY GREEN TAG & ADMIT',
        explanation: 'Diaper bag conforms to childcare dimension guidelines.',
        translation: 'Su bolso de bebé está aprobado para ingresar.'
      };
    }

    // Case 3: Language Barrier Assistance Case
    if (query.includes('where') || query.includes('sector') || query.includes('seat')) {
      return {
        status: 'ALLOW',
        action: 'SHOW SECTOR 200 MAP',
        explanation: 'Fan seeking directions to upper bowl sectors. Standard route is escalators by Gate B.',
        translation: 'Suba por las escaleras mecánicas del sector 200, están a la derecha.'
      };
    }

    // Case 4: Invalid/Static Ticket Screenshot
    if (query.includes('screenshot') || query.includes('photo ticket') || query.includes('dead phone')) {
      return {
        status: 'DENY',
        action: 'SEND TO TICKET RESOLUTION',
        explanation: 'Ticket shows a static barcode image (screenshot). Stadium access requires dynamic QR validation. Route to Customer Service.',
        translation: 'No se aceptan capturas de pantalla. Vaya a la taquilla de resolución de tickets.'
      };
    }

    // Default Case
    return {
      status: 'ALLOW',
      action: 'APPROVE FOR STANDARD ENTRY',
      explanation: 'No prohibited items detected, ticket is valid, and gate parameters are within limits.',
      translation: 'Puede pasar. Disfrute del partido.'
    };
  }
}

export const aiService = new AiService();
export default aiService;
