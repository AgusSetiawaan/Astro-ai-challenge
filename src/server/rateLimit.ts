export interface RateCheckResult {
  ok: boolean;
  remaining: number;
  resetAt: number;
}

export interface RateLimiter {
  check(ip: string): RateCheckResult;
}

interface Bucket {
  count: number;
  resetAt: number;
}

export function createRateLimiter(opts: { perHour: number }): RateLimiter {
  const windowMs = 60 * 60 * 1000;
  const buckets = new Map<string, Bucket>();

  return {
    check(ip) {
      const now = Date.now();
      const existing = buckets.get(ip);
      if (!existing || existing.resetAt <= now) {
        const fresh: Bucket = { count: 1, resetAt: now + windowMs };
        buckets.set(ip, fresh);
        return { ok: true, remaining: opts.perHour - 1, resetAt: fresh.resetAt };
      }
      if (existing.count >= opts.perHour) {
        return { ok: false, remaining: 0, resetAt: existing.resetAt };
      }
      existing.count++;
      return { ok: true, remaining: opts.perHour - existing.count, resetAt: existing.resetAt };
    },
  };
}
