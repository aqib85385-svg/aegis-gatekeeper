const ipRequests = new Map<string, number[]>();

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
}

export function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number,
  now: number = Date.now()
): RateLimitResult {
  let timestamps = ipRequests.get(key) || [];
  
  // Filter out expired timestamps
  const windowStart = now - windowMs;
  timestamps = timestamps.filter((t: number) => t > windowStart);
  
  if (timestamps.length < maxRequests) {
    timestamps.push(now);
    ipRequests.set(key, timestamps);
    return {
      allowed: true,
      remaining: maxRequests - timestamps.length,
      retryAfterMs: 0
    };
  }
  
  // Calculate retry after
  const oldest = timestamps[0];
  const retryAfterMs = oldest + windowMs - now;
  
  return {
    allowed: false,
    remaining: 0,
    retryAfterMs: Math.max(0, retryAfterMs)
  };
}

export function resetRateLimits(): void {
  ipRequests.clear();
}
