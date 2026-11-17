// Counts AI messages in a time window. The memory version resets when the server
// restarts; the Upstash version (REST) is shared by every serverless instance.
export function createMemoryLimiter(now = Date.now) {
  const hits = new Map();
  return {
    async hit(key, limit, windowMs) {
      const recent = (hits.get(key) ?? []).filter((time) => now() - time < windowMs);
      if (recent.length >= limit) {
        hits.set(key, recent);
        return { allowed: false, retryAfterMs: recent[0] + windowMs - now() };
      }
      recent.push(now());
      hits.set(key, recent);
      return { allowed: true, retryAfterMs: 0 };
    },
  };
}

export function createUpstashLimiter({ url, token }, fetchImpl = fetch) {
  return {
    async hit(key, limit, windowMs) {
      const response = await fetchImpl(`${url.replace(/\/$/, '')}/pipeline`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify([
          ['INCR', key],
          ['PEXPIRE', key, String(windowMs), 'NX'],
          ['PTTL', key],
        ]),
        signal: AbortSignal.timeout(3000),
      });
      if (!response.ok) throw new Error('The usage counter is unavailable.');
      const [count, , ttl] = (await response.json()).map((item) => item.result);
      return {
        allowed: Number(count) <= limit,
        retryAfterMs: Number(ttl) > 0 ? Number(ttl) : windowMs,
      };
    },
  };
}

// Uses the shared counter when its keys are set; if it fails, falls back to memory
// so messages stay limited either way.
export function createLimiter(env = process.env, fetchImpl = fetch) {
  const url = env.KV_REST_API_URL || env.UPSTASH_REDIS_REST_URL;
  const token = env.KV_REST_API_TOKEN || env.UPSTASH_REDIS_REST_TOKEN;
  const memory = createMemoryLimiter();
  if (!url || !token) return memory;
  const shared = createUpstashLimiter({ url, token }, fetchImpl);
  return {
    async hit(key, limit, windowMs) {
      try {
        return await shared.hit(key, limit, windowMs);
      } catch {
        return memory.hit(key, limit, windowMs);
      }
    },
  };
}
