import { describe, it, expect, beforeEach, vi } from 'vitest';
import { aiService } from '../../src/services/aiService';

// Mock FileReader globally for the Node environment so blobToBase64 works
if (typeof global.FileReader === 'undefined') {
  global.FileReader = class {
    public onloadend: (() => void) | null = null;
    public onerror: (() => void) | null = null;
    public result: string = 'data:image/jpeg;base64,mockbase64encodedstringdata';
    
    public readAsDataURL(_blob: Blob) {
      // Simulate asynchronous successful load
      setTimeout(() => {
        if (this.onloadend) {
          this.onloadend();
        }
      }, 5);
    }
  } as any;
}

describe('Aegis GateKeeper AI Service', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    aiService.setMockMode(false); // Default to live proxy mode to test network paths
  });

  // ==========================================
  // 1. MOCK RESPONSE / OFFLINE LOGIC TESTS
  // ==========================================

  it('should generate dynamic gate redirection under peak surge criteria', () => {
    const context = 'Crowded line at Gate C, fan is complaining';
    const telemetry = { queueMinutes: 25, timeToKickoff: 10 };

    const response = aiService.generateMockResponse(context, telemetry);
    expect(response.status).toBe('REVIEW');
    expect(response.action).toBe('REDIRECT TO GATE D');
    expect(response.explanation).toContain('kickoff');
  });

  it('should allow entry if queue times are low even near kickoff', () => {
    const context = 'Line check at Gate C';
    const telemetry = { queueMinutes: 2, timeToKickoff: 10 };

    const response = aiService.generateMockResponse(context, telemetry);
    expect(response.status).toBe('ALLOW');
    expect(response.action).toBe('PROCEED TO TURNSTILE');
  });

  it('should flag childcare bag containing metal flask for review and emptying', () => {
    const context = 'Checking diaper bag containing a metal flask of milk';
    const telemetry = { queueMinutes: 2, timeToKickoff: 45 };

    const response = aiService.generateMockResponse(context, telemetry);
    expect(response.status).toBe('REVIEW');
    expect(response.action).toBe('EMPTY FLASK & TAG DIAPER BAG');
  });

  it('should admit standard diaper bags without prohibited metal items', () => {
    const context = 'Review diaper bag for baby items';
    const telemetry = { queueMinutes: 2, timeToKickoff: 45 };

    const response = aiService.generateMockResponse(context, telemetry);
    expect(response.status).toBe('ALLOW');
    expect(response.action).toBe('APPLY GREEN TAG & ADMIT');
  });

  it('should navigate language barrier queries to map directions', () => {
    const context = 'Where is sector 220?';
    const telemetry = { queueMinutes: 2, timeToKickoff: 45 };

    const response = aiService.generateMockResponse(context, telemetry);
    expect(response.status).toBe('ALLOW');
    expect(response.action).toBe('SHOW SECTOR 200 MAP');
  });

  it('should reject access and route to resolution window on screenshot tickets', () => {
    const context = 'Fan presented a dynamic screenshot ticket copy';
    const telemetry = { queueMinutes: 2, timeToKickoff: 45 };

    const response = aiService.generateMockResponse(context, telemetry);
    expect(response.status).toBe('DENY');
    expect(response.action).toBe('SEND TO TICKET RESOLUTION');
  });

  it('should return a standard admit response on default matching criteria', () => {
    const context = 'Standard verification check';
    const telemetry = { queueMinutes: 2, timeToKickoff: 45 };

    const response = aiService.generateMockResponse(context, telemetry);
    expect(response.status).toBe('ALLOW');
    expect(response.action).toBe('APPROVE FOR STANDARD ENTRY');
  });

  // ==========================================
  // 2. OFFLINE / LOCAL MOCK BYPASS TESTS
  // ==========================================

  it('should process analyzeGateIncident in mock mode without calling fetch', async () => {
    aiService.setMockMode(true);
    const fetchMock = vi.fn();
    global.fetch = fetchMock;

    const result = await aiService.analyzeGateIncident(null, 'lost ticket assist', { queueMinutes: 2, timeToKickoff: 45 });
    expect(fetchMock).toHaveBeenCalledTimes(0);
    expect(result.status).toBe('ALLOW');
  });

  it('should trigger local safety policy engine bypass before calling API', async () => {
    const fetchMock = vi.fn();
    global.fetch = fetchMock;

    // Security warning terms should trigger deterministic policy bypass instantly
    const result = await aiService.analyzeGateIncident(null, 'weapon detected at turnstile', { queueMinutes: 2, timeToKickoff: 45 });
    expect(fetchMock).toHaveBeenCalledTimes(0);
    expect(result.status).toBe('DENY');
    expect(result.action).toBe('ALERT SECURITY IMMEDIATELY');
  });

  // ==========================================
  // 3. API RESPONSE / EXCEPTION INTEGRATION TESTS
  // ==========================================

  it('should successfully call API and return a validated ALLOW response', async () => {
    const mockResponse = {
      status: 'ALLOW',
      action: 'Admit Fan',
      explanation: 'Ticket checks passed.',
      translation: 'Pase.'
    };

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse
    });
    global.fetch = fetchMock;

    const result = await aiService.analyzeGateIncident(null, 'admit standard check', { queueMinutes: 2, timeToKickoff: 45 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.status).toBe('ALLOW');
    expect(result.action).toBe('Admit Fan');
  });

  it('should convert and send a base64 image string when an image blob is provided', async () => {
    const mockResponse = {
      status: 'ALLOW',
      action: 'Baggage clear',
      explanation: 'Baggage size verified.',
      translation: 'Adelante.'
    };

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse
    });
    global.fetch = fetchMock;

    const mockBlob = new Blob(['mockbinarydata'], { type: 'image/jpeg' });

    await aiService.analyzeGateIncident(mockBlob, 'scanning diaper bag', { queueMinutes: 2, timeToKickoff: 45 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    
    // Check fetch payload details
    const lastCall = fetchMock.mock.calls[0];
    const body = JSON.parse(lastCall[1].body);
    expect(body.image).toBe('mockbase64encodedstringdata');
  });

  it('should fallback to local mock when API returns a 500 error status', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500
    });
    global.fetch = fetchMock;

    const result = await aiService.analyzeGateIncident(null, 'line check at Gate C', { queueMinutes: 25, timeToKickoff: 10 });
    expect(result.status).toBe('REVIEW');
    expect(result.action).toBe('REDIRECT TO GATE D');
  });

  it('should fallback to local mock on network fetch throws/exceptions', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('Network connection timeout.'));
    global.fetch = fetchMock;

    const result = await aiService.analyzeGateIncident(null, 'ticket screenshot copy', { queueMinutes: 2, timeToKickoff: 45 });
    expect(result.status).toBe('DENY');
    expect(result.action).toBe('SEND TO TICKET RESOLUTION');
  });

  it('should fallback to local mock when API returns invalid JSON structure', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => { throw new Error('SyntaxError: Unexpected token'); }
    });
    global.fetch = fetchMock;

    const result = await aiService.analyzeGateIncident(null, 'diaper bag with flask', { queueMinutes: 2, timeToKickoff: 45 });
    expect(result.status).toBe('REVIEW');
    expect(result.action).toBe('EMPTY FLASK & TAG DIAPER BAG');
  });

  it('should fallback to local mock when schema validation contract fails', async () => {
    const invalidSchemaResponse = {
      status: 'INVALID_STATUS_ENUM', // Fails Zod validation
      action: 'Admit',
      explanation: 'Ticket OK'
      // translation is missing!
    };

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => invalidSchemaResponse
    });
    global.fetch = fetchMock;

    const result = await aiService.analyzeGateIncident(null, 'diaper bag with flask', { queueMinutes: 2, timeToKickoff: 45 });
    expect(result.status).toBe('REVIEW');
    expect(result.action).toBe('Manual Review Needed');
  });
});
