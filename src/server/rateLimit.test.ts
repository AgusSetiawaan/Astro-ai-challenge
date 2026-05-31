import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createRateLimiter } from './rateLimit';

describe('createRateLimiter', () => {
  beforeEach(() => { vi.useFakeTimers().setSystemTime(0); });

  it('allows up to N requests per window', () => {
    const rl = createRateLimiter({ perHour: 3 });
    expect(rl.check('1.1.1.1').ok).toBe(true);
    expect(rl.check('1.1.1.1').ok).toBe(true);
    expect(rl.check('1.1.1.1').ok).toBe(true);
    const fourth = rl.check('1.1.1.1');
    expect(fourth.ok).toBe(false);
    expect(fourth.resetAt).toBeGreaterThan(0);
  });

  it('isolates per-IP', () => {
    const rl = createRateLimiter({ perHour: 1 });
    expect(rl.check('a').ok).toBe(true);
    expect(rl.check('b').ok).toBe(true);
    expect(rl.check('a').ok).toBe(false);
  });

  it('refills after window elapses', () => {
    const rl = createRateLimiter({ perHour: 1 });
    expect(rl.check('x').ok).toBe(true);
    expect(rl.check('x').ok).toBe(false);
    vi.setSystemTime(60 * 60 * 1000 + 1);
    expect(rl.check('x').ok).toBe(true);
  });
});
