export interface RateLimitGuardResult {
  status: number;
  retryAfterSeconds: number;
  body: {
    error: string;
    exception?: string;
    stack?: string;
  };
}

export function applyRateLimitGuard(
  ip: string,
  maxRequests?: number,
  windowMs?: number
): RateLimitGuardResult | null;
