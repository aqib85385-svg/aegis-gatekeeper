import { describe, it, expect } from 'vitest';
import { checkLocalPolicy } from '../../src/services/policyEngine';

describe('Aegis GateKeeper Policy Engine Bypass', () => {
  it('should trigger security alert on weapon keywords', () => {
    const report = 'Fan is carrying a knife at the turnstile';
    const decision = checkLocalPolicy(report);

    expect(decision).not.toBeNull();
    expect(decision?.status).toBe('DENY');
    expect(decision?.action).toBe('ALERT SECURITY IMMEDIATELY');
    expect(decision?.explanation).toContain('threat triggered locally');
  });

  it('should trigger medical alert on emergency health keywords', () => {
    const report = 'A child has collapsed due to heat stroke';
    const decision = checkLocalPolicy(report);

    expect(decision).not.toBeNull();
    expect(decision?.status).toBe('REVIEW');
    expect(decision?.action).toBe('CALL MEDICAL RESPONDERS');
    expect(decision?.explanation).toContain('medical safety trigger');
  });

  it('should ignore casing and whitespace when matching safety terms', () => {
    const report = '   GUN detected in sector 10   ';
    const decision = checkLocalPolicy(report);

    expect(decision).not.toBeNull();
    expect(decision?.status).toBe('DENY');
  });

  it('should return null and bypass policy for non-emergency observations', () => {
    const report = 'The fan has a large childcare bag, checking diaper count.';
    const decision = checkLocalPolicy(report);

    expect(decision).toBeNull(); // Does not match any critical emergency keywords
  });
});
