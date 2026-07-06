import { describe, it, expect } from 'vitest';
import { safeParseDecision } from '../../src/utils/schema';

describe('Aegis GateKeeper Zod Schema Validation', () => {
  it('should successfully parse a valid allow decision', () => {
    const validPayload = {
      status: 'ALLOW',
      action: 'Admit to stadium',
      explanation: 'Verified active ticketing dynamic barcode.',
      translation: 'Puede pasar.'
    };

    const parsed = safeParseDecision(validPayload);
    expect(parsed.status).toBe('ALLOW');
    expect(parsed.action).toBe('Admit to stadium');
    expect(parsed.explanation).toBe('Verified active ticketing dynamic barcode.');
    expect(parsed.translation).toBe('Puede pasar.');
  });

  it('should successfully parse a valid deny decision', () => {
    const validPayload = {
      status: 'DENY',
      action: 'REJECT ACCESS',
      explanation: 'Static screenshot detected. Direct to ticket resolution.',
      translation: 'Vaya a la taquilla.'
    };

    const parsed = safeParseDecision(validPayload);
    expect(parsed.status).toBe('DENY');
    expect(parsed.action).toBe('REJECT ACCESS');
  });

  it('should fallback gracefully to REVIEW status when payload is missing parameters', () => {
    const incompletePayload = {
      status: 'ALLOW',
      action: 'Proceed'
      // explanation and translation are missing!
    };

    const parsed = safeParseDecision(incompletePayload);
    expect(parsed.status).toBe('REVIEW');
    expect(parsed.action).toBe('Manual Review Needed');
    expect(parsed.explanation).toContain('Schema validation failed');
  });

  it('should fallback gracefully when status is an invalid enum value', () => {
    const badStatusPayload = {
      status: 'APPROVE_ENTRY', // Invalid status enum! (Should be ALLOW/REVIEW/DENY)
      action: 'Proceed',
      explanation: 'Valid ticket',
      translation: 'Adelante'
    };

    const parsed = safeParseDecision(badStatusPayload);
    expect(parsed.status).toBe('REVIEW');
    expect(parsed.action).toBe('Manual Review Needed');
  });

  it('should handle null or invalid object payloads cleanly', () => {
    expect(safeParseDecision(null).status).toBe('REVIEW');
    expect(safeParseDecision(undefined).status).toBe('REVIEW');
    expect(safeParseDecision('plain string').status).toBe('REVIEW');
  });
});
