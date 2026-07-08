import { checkRateLimit } from './rateLimiter.js';
import { formatError } from './errorHelper.js';

export function applyRateLimitGuard(ip, maxRequests = 20, windowMs = 60000) {
  const result = checkRateLimit(ip, maxRequests, windowMs);
  if (result.allowed) return null;
  
  const retrySeconds = Math.ceil(result.retryAfterMs / 1000);
  return {
    status: 429,
    retryAfterSeconds: retrySeconds,
    body: formatError('Too Many Requests', `Rate limit exceeded. Please try again in ${retrySeconds} seconds.`)
  };
}
