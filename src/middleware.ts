import { defineMiddleware } from 'astro:middleware';

// 'unsafe-inline' is required because Astro emits inline hydration scripts
// for islands (<astro-island> custom-element bootstrap + per-island runner)
// and we have no per-request nonce plumbing. Tighten to nonces in a follow-up.
const SCRIPT_SRC = "'self' 'unsafe-inline'";

const CSP = [
  "default-src 'self'",
  `script-src ${SCRIPT_SRC}`,
  "style-src 'self' 'unsafe-inline'",
  "connect-src 'self'",
  "img-src 'self' data:",
  "frame-ancestors 'none'",
].join('; ');

export const onRequest = defineMiddleware(async (_ctx, next) => {
  const res = await next();
  res.headers.set('Content-Security-Policy', CSP);
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('Referrer-Policy', 'no-referrer');
  res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  return res;
});
