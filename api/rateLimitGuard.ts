import { checkRateLimit } from './rateLimiter.js';
import { formatError, type FormattedError } from './errorHelper.js';

export interface RateLimitGuardResult {
  status: number;
  retryAfterSeconds: number;
  body: FormattedError;
}

export function applyRateLimitGuard(
  ip: string,
  maxRequests: number = 20,
  windowMs: number = 60000
): RateLimitGuardResult | null {
  const result = checkRateLimit(ip, maxRequests, windowMs);
  if (result.allowed) return null;
  
  const retrySeconds = Math.ceil(result.retryAfterMs / 1000);
  return {
    status: 429,
    retryAfterSeconds: retrySeconds,
    body: formatError('Too Many Requests', `Rate limit exceeded. Please try again in ${retrySeconds} seconds.`)
  };
}
