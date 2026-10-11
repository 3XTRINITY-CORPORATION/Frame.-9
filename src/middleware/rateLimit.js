// Tiny fixed-window, in-memory, per-IP rate limiter with a bounded key store.
// Suitable for a single process; use a shared store behind multiple instances.
function createRateLimiter({ windowMs = 60_000, max = 30, maxKeys = 10_000, now = Date.now } = {}) {
  const hits = new Map();

  return function rateLimit(req, res, next) {
    const t = now();
    const key = req.ip || 'unknown';
    let entry = hits.get(key);

    if (!entry || t >= entry.resetAt) {
      if (!entry && hits.size >= maxKeys) {
        // Evict expired entries first, then the oldest one, to keep memory bounded.
        for (const [k, v] of hits) if (t >= v.resetAt) hits.delete(k);
        if (hits.size >= maxKeys) hits.delete(hits.keys().next().value);
      }
      entry = { count: 0, resetAt: t + windowMs };
      hits.set(key, entry);
    }

    entry.count += 1;
    if (entry.count > max) {
      res.set('Retry-After', String(Math.ceil((entry.resetAt - t) / 1000)));
      return res.status(429).json({ ok: false, error: 'Too many requests' });
    }
    return next();
  };
}

module.exports = { createRateLimiter };
