import { describe, it, expect, beforeEach } from 'vitest';
import { checkRateLimit, resetRateLimits } from '../../api/rateLimiter.js';
import { applyRateLimitGuard } from '../../api/rateLimitGuard.js';

describe('checkRateLimit sliding-window tests', () => {
  beforeEach(() => {
    resetRateLimits();
  });

  it('should allow requests under the limit and decrement remaining requests', () => {
    const key = '192.168.1.1';
    const now = 1000;
    
    // Send 20 requests
    for (let i = 0; i < 20; i++) {
      const res = checkRateLimit(key, 20, 60000, now);
      expect(res.allowed).toBe(true);
      expect(res.remaining).toBe(20 - (i + 1));
      expect(res.retryAfterMs).toBe(0);
    }
  });

  it('should block the 21st request when limit is 20', () => {
    const key = '10.0.0.1';
    const now = 1000;
    
    // First 20 requests are allowed
    for (let i = 0; i < 20; i++) {
      checkRateLimit(key, 20, 60000, now);
    }
    
    // 21st request is blocked
    const res = checkRateLimit(key, 20, 60000, now);
    expect(res.allowed).toBe(false);
    expect(res.remaining).toBe(0);
    expect(res.retryAfterMs).toBe(60000); // oldest is at 1000, next window expires at 1000 + 60000 = 61000. 61000 - 1000 = 60000.
  });

  it('should allow request again after the sliding window expires', () => {
    const key = '172.16.0.1';
    const baseTime = 1000;
    
    // Fill the limit at baseTime (1000)
    for (let i = 0; i < 20; i++) {
      checkRateLimit(key, 20, 60000, baseTime);
    }
    
    // Blocked at 1000
    const blockedRes = checkRateLimit(key, 20, 60000, baseTime);
    expect(blockedRes.allowed).toBe(false);
    
    // Advance time by 60,001 ms (beyond the 60 second window)
    const futureTime = baseTime + 60001; // 61001
    
    // Now allowed again
    const allowedRes = checkRateLimit(key, 20, 60000, futureTime);
    expect(allowedRes.allowed).toBe(true);
    expect(allowedRes.remaining).toBe(19); // 20 requests from baseTime are now expired
  });

  it('should clear limits when resetRateLimits is called', () => {
    const key = '8.8.8.8';
    const now = 1000;
    
    // Exhaust limit
    for (let i = 0; i < 20; i++) {
      checkRateLimit(key, 20, 60000, now);
    }
    
    // Blocked
    const beforeReset = checkRateLimit(key, 20, 60000, now);
    expect(beforeReset.allowed).toBe(false);
    
    // Reset limits
    resetRateLimits();
    
    // Allowed again
    const afterReset = checkRateLimit(key, 20, 60000, now);
    expect(afterReset.allowed).toBe(true);
    expect(afterReset.remaining).toBe(19);
  });
});

describe('applyRateLimitGuard wrapper tests', () => {
  beforeEach(() => {
    resetRateLimits();
  });

  it('should return null when the request is allowed', () => {
    const res = applyRateLimitGuard('192.168.1.1', 5, 60000);
    expect(res).toBeNull();
  });

  it('should return 429 payload structure when the request is rate-limited', () => {
    const key = '10.0.0.1';
    
    // Send 5 requests to hit limit
    for (let i = 0; i < 5; i++) {
      applyRateLimitGuard(key, 5, 60000);
    }
    
    // 6th request is blocked
    const res = applyRateLimitGuard(key, 5, 60000);
    expect(res).not.toBeNull();
    expect(res?.status).toBe(429);
    expect(res?.retryAfterSeconds).toBe(60);
    expect(res?.body).toEqual({
      error: 'Too Many Requests',
      exception: 'Rate limit exceeded. Please try again in 60 seconds.'
    });
  });
});
