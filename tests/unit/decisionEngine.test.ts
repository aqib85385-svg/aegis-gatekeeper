import { describe, it, expect } from 'vitest';
import { evaluateBaggage } from '../../src/services/decisionEngine';

describe('DecisionEngine evaluateBaggage pure tests', () => {
  it('should redirect to Gate D under peak kickoff surge conditions', () => {
    const query = 'Crowded gate queue queue wait';
    const telemetry = { queueMinutes: 20, timeToKickoff: 15 };
    const result = evaluateBaggage(query, telemetry);

    expect(result.status).toBe('REVIEW');
    expect(result.action).toBe('REDIRECT TO GATE D');
    expect(result.reason).toContain('Override ticket gate allocation');
  });

  it('should proceed to turnstile under normal gate entry conditions', () => {
    const query = 'Crowd gate line queue';
    const telemetry = { queueMinutes: 5, timeToKickoff: 45 };
    const result = evaluateBaggage(query, telemetry);

    expect(result.status).toBe('ALLOW');
    expect(result.action).toBe('PROCEED TO TURNSTILE');
  });

  it('should flag diaper bag for REVIEW if flask is present (exact E2E case)', () => {
    const query = 'Diaper bag containing baby formula and a clean empty flask.';
    const result = evaluateBaggage(query);

    expect(result.status).toBe('REVIEW');
    expect(result.action).toBe('EMPTY FLASK & TAG DIAPER BAG');
    expect(result.reason).toContain('metal flask must be emptied');
  });

  it('should ALLOW diaper bag if no prohibited metal items are present', () => {
    const query = 'Diaper bag for baby check';
    const result = evaluateBaggage(query);

    expect(result.status).toBe('ALLOW');
    expect(result.action).toBe('APPLY GREEN TAG & ADMIT');
  });

  it('should show map directions for language barrier sector queries', () => {
    const query = 'where is sector 200';
    const result = evaluateBaggage(query);

    expect(result.status).toBe('ALLOW');
    expect(result.action).toBe('SHOW SECTOR 200 MAP');
  });

  it('should DENY entry for static ticket screenshots', () => {
    const query = 'screenshot of ticket';
    const result = evaluateBaggage(query);

    expect(result.status).toBe('DENY');
    expect(result.action).toBe('SEND TO TICKET RESOLUTION');
  });

  it('should ALLOW entry by default for standard ticket/scan query', () => {
    const query = 'Standard fan check';
    const result = evaluateBaggage(query);

    expect(result.status).toBe('ALLOW');
    expect(result.action).toBe('APPROVE FOR STANDARD ENTRY');
  });
});
