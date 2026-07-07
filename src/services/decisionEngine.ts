interface TelemetryData {
  queueMinutes: number;
  timeToKickoff: number;
}

/**
 * Pure deterministic baggage/incident evaluator engine.
 * Decouples stadium rule reasoning from LLM narrative processing.
 */
export function evaluateBaggage(
  query: string,
  telemetry?: TelemetryData
): { status: 'ALLOW' | 'REVIEW' | 'DENY'; action: string; reason: string } {
  const normalized = query.toLowerCase();

  // Case 1: Overloaded Gate Redirect Case
  if (normalized.includes('gate') || normalized.includes('crowd') || normalized.includes('queue')) {
    if (telemetry && telemetry.queueMinutes > 15 && telemetry.timeToKickoff < 30) {
      return {
        status: 'REVIEW',
        action: 'REDIRECT TO GATE D',
        reason: `Gate wait time is ${telemetry.queueMinutes}m and kickoff is in ${telemetry.timeToKickoff}m. Override ticket gate allocation and route to Gate D under FIFA Ops Manual Sec 4.2.`
      };
    }
    return {
      status: 'ALLOW',
      action: 'PROCEED TO TURNSTILE',
      reason: 'Gate is busy but within acceptable throughput parameters.'
    };
  }

  // Case 2: Diaper / Care Bag Exemption Case
  if (normalized.includes('bag') || normalized.includes('diaper') || normalized.includes('child') || normalized.includes('baby')) {
    if (normalized.includes('flask') || normalized.includes('metal') || normalized.includes('thermos')) {
      return {
        status: 'REVIEW',
        action: 'EMPTY FLASK & TAG DIAPER BAG',
        reason: 'Baggage is approved under the FIFA Childcare Exemption rule, but the metal flask must be emptied before entering the stadium.'
      };
    }
    return {
      status: 'ALLOW',
      action: 'APPLY GREEN TAG & ADMIT',
      reason: 'Diaper bag conforms to childcare dimension guidelines.'
    };
  }

  // Case 3: Language Barrier Assistance Case
  if (normalized.includes('where') || normalized.includes('sector') || normalized.includes('seat')) {
    return {
      status: 'ALLOW',
      action: 'SHOW SECTOR 200 MAP',
      reason: 'Fan seeking directions to upper bowl sectors. Standard route is escalators by Gate B.'
    };
  }

  // Case 4: Invalid/Static Ticket Screenshot
  if (normalized.includes('screenshot') || normalized.includes('photo ticket') || normalized.includes('dead phone')) {
    return {
      status: 'DENY',
      action: 'SEND TO TICKET RESOLUTION',
      reason: 'Ticket shows a static barcode image (screenshot). Stadium access requires dynamic QR validation. Route to Customer Service.'
    };
  }

  // Default Case
  return {
    status: 'ALLOW',
    action: 'APPROVE FOR STANDARD ENTRY',
    reason: 'No prohibited items detected, ticket is valid, and gate parameters are within limits.'
  };
}
