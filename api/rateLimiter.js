const ipRequests = new Map();

export function checkRateLimit(key, maxRequests, windowMs, now = Date.now()) {
  let timestamps = ipRequests.get(key) || [];
  
  // Filter out expired timestamps
  const windowStart = now - windowMs;
  timestamps = timestamps.filter(t => t > windowStart);
  
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

export function resetRateLimits() {
  ipRequests.clear();
}
