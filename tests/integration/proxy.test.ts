import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import handler from '../../api/decision-proxy';

describe('Aegis GateKeeper Secure Proxy Handler', () => {
  beforeEach(() => {
    // Set up local environment mock variables
    process.env.GEMINI_API_KEY = 'mock-api-key';
    vi.restoreAllMocks();
  });

  // ==========================================
  // 1. CORS PREFLIGHT & ROUTING METHOD TESTS
  // ==========================================

  it('should support OPTIONS CORS preflight request with 200 status', async () => {
    const req = { method: 'OPTIONS' } as unknown as VercelRequest;
    
    const endMock = vi.fn();
    const statusMock = vi.fn().mockReturnValue({ end: endMock });
    const res = {
      setHeader: vi.fn(),
      status: statusMock
    } as unknown as VercelResponse;

    await handler(req, res);

    expect(statusMock).toHaveBeenCalledWith(200);
    expect(endMock).toHaveBeenCalledTimes(1);
  });

  it('should reject requests with non-POST methods', async () => {
    const req = { method: 'GET' } as unknown as VercelRequest;
    
    const jsonMock = vi.fn();
    const statusMock = vi.fn().mockReturnValue({ json: jsonMock });
    const res = {
      setHeader: vi.fn(),
      status: statusMock
    } as unknown as VercelResponse;

    await handler(req, res);

    expect(statusMock).toHaveBeenCalledWith(405);
    expect(jsonMock).toHaveBeenCalledWith({ error: 'Method not allowed' });
  });

  // ==========================================
  // 2. CONFIGURATION VALIDATION TESTS
  // ==========================================

  it('should return a 500 error if API Key is missing on the server', async () => {
    delete process.env.GEMINI_API_KEY;

    const req = {
      method: 'POST',
      body: {
        text: 'Check dynamic status'
      }
    } as unknown as VercelRequest;

    const jsonMock = vi.fn();
    const statusMock = vi.fn().mockReturnValue({ json: jsonMock });
    const res = {
      setHeader: vi.fn(),
      status: statusMock
    } as unknown as VercelResponse;

    await handler(req, res);

    expect(statusMock).toHaveBeenCalledWith(500);
    expect(jsonMock).toHaveBeenCalledWith(expect.objectContaining({
      error: expect.stringContaining('API Key not configured')
    }));
  });

  // ==========================================
  // 3. API CALL & UPSTREAM RESPONSE TESTS
  // ==========================================

  it('should successfully proxy POST requests and return mock model results', async () => {
    const req = {
      method: 'POST',
      body: {
        text: 'diaper bag check',
        telemetry: { queueMinutes: 5, timeToKickoff: 45 }
      }
    } as unknown as VercelRequest;

    const mockResponsePayload = {
      candidates: [
        {
          content: {
            parts: [
              {
                text: JSON.stringify({
                  status: 'REVIEW',
                  action: 'Inspect and Tag Diaper Bag',
                  explanation: 'Approved under childcare exemption guidelines.',
                  translation: 'Bolso aprobado.'
                })
              }
            ]
          }
        }
      ]
    };

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponsePayload
    });
    global.fetch = fetchMock;

    const jsonMock = vi.fn();
    const statusMock = vi.fn().mockReturnValue({ json: jsonMock });
    const res = {
      setHeader: vi.fn(),
      status: statusMock
    } as unknown as VercelResponse;

    await handler(req, res);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(statusMock).toHaveBeenCalledWith(200);
    expect(jsonMock).toHaveBeenCalledWith({
      status: 'REVIEW',
      action: 'Inspect and Tag Diaper Bag',
      explanation: 'Approved under childcare exemption guidelines.',
      translation: 'Bolso aprobado.'
    });
  });

  it('should format and forward base64 image data to upstream models when attached', async () => {
    const req = {
      method: 'POST',
      body: {
        text: 'bag check',
        image: 'mockbase64data'
      }
    } as unknown as VercelRequest;

    const mockResponsePayload = {
      candidates: [
        {
          content: {
            parts: [
              {
                text: JSON.stringify({
                  status: 'ALLOW',
                  action: 'Clear',
                  explanation: 'No hazards.',
                  translation: 'Pase'
                })
              }
            ]
          }
        }
      ]
    };

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponsePayload
    });
    global.fetch = fetchMock;

    const jsonMock = vi.fn();
    const statusMock = vi.fn().mockReturnValue({ json: jsonMock });
    const res = {
      setHeader: vi.fn(),
      status: statusMock
    } as unknown as VercelResponse;

    await handler(req, res);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const lastCall = fetchMock.mock.calls[0];
    const body = JSON.parse(lastCall[1].body);
    expect(body.contents[0].parts[1].inlineData.data).toBe('mockbase64data');
  });

  it('should return upstream API non-200 failure code to the client', async () => {
    const req = {
      method: 'POST',
      body: {
        text: 'Checking status'
      }
    } as unknown as VercelRequest;

    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      text: async () => 'Quota exceeded or invalid credentials.'
    });
    global.fetch = fetchMock;

    const jsonMock = vi.fn();
    const statusMock = vi.fn().mockReturnValue({ json: jsonMock });
    const res = {
      setHeader: vi.fn(),
      status: statusMock
    } as unknown as VercelResponse;

    await handler(req, res);

    expect(statusMock).toHaveBeenCalledWith(403);
    expect(jsonMock).toHaveBeenCalledWith({ error: 'Upstream model service error' });
  });

  it('should return a 500 status when the upstream response candidates are empty', async () => {
    const req = {
      method: 'POST',
      body: {
        text: 'Empty candidate test'
      }
    } as unknown as VercelRequest;

    const mockEmptyPayload = {
      candidates: [] // Empty candidates array!
    };

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockEmptyPayload
    });
    global.fetch = fetchMock;

    const jsonMock = vi.fn();
    const statusMock = vi.fn().mockReturnValue({ json: jsonMock });
    const res = {
      setHeader: vi.fn(),
      status: statusMock
    } as unknown as VercelResponse;

    await handler(req, res);

    expect(statusMock).toHaveBeenCalledWith(500);
    expect(jsonMock).toHaveBeenCalledWith(expect.objectContaining({
      error: expect.stringContaining('Empty response from model candidate')
    }));
  });

  it('should return a 500 status on unexpected exceptions inside fetch handlers', async () => {
    const req = {
      method: 'POST',
      body: {
        text: 'Fetch exception test'
      }
    } as unknown as VercelRequest;

    const fetchMock = vi.fn().mockRejectedValue(new Error('Connection timed out.'));
    global.fetch = fetchMock;

    const jsonMock = vi.fn();
    const statusMock = vi.fn().mockReturnValue({ json: jsonMock });
    const res = {
      setHeader: vi.fn(),
      status: statusMock
    } as unknown as VercelResponse;

    await handler(req, res);

    expect(statusMock).toHaveBeenCalledWith(500);
    expect(jsonMock).toHaveBeenCalledWith({
      error: 'Failed to process decision request: Connection timed out.'
    });
  });
});
