import { request as httpRequest, createServer } from 'node:http';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createHandler } from '../../server/http';
import { loadAiConfig } from '../../server/ai/config';
import {
  createLimiter,
  createMemoryLimiter,
  createUpstashLimiter,
} from '../../server/limiter';
import { aiReply, chatRequest } from '../ai-fixtures';

function call(port, { method = 'GET', path, host, origin, body }) {
  return new Promise((resolve, reject) => {
    const req = httpRequest(
      {
        host: '127.0.0.1',
        port,
        method,
        path,
        headers: {
          Host: host,
          ...(origin ? { Origin: origin } : {}),
          ...(body ? { 'Content-Type': 'application/json' } : {}),
        },
      },
      (res) => {
        let text = '';
        res.on('data', (chunk) => (text += chunk));
        res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(text) }));
      },
    );
    req.on('error', reject);
    req.end(body ? JSON.stringify(body) : undefined);
  });
}

describe('hosted (Vercel) handler', () => {
  let server;
  let port;
  const ai = vi.fn().mockResolvedValue(aiReply());
  beforeAll(async () => {
    server = createServer(
      createHandler(loadAiConfig({ GEMINI_API_KEY: 'k' }), {
        ai,
        hosted: true,
        dailyLimit: 2,
        limiter: createMemoryLimiter(),
      }),
    );
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    port = server.address().port;
  });
  afterAll(() => new Promise((resolve) => server.close(resolve)));

  it('accepts requests for its own public address', async () => {
    const status = await call(port, { path: '/api/ai/status', host: 'seite.vercel.app' });
    expect(status.status).toBe(200);
    expect(JSON.stringify(status.body)).not.toContain('"k"');
  });
  it('rejects other origins and malformed origins', async () => {
    const send = (origin) =>
      call(port, {
        method: 'POST',
        path: '/api/chat',
        host: 'seite.vercel.app',
        origin,
        body: chatRequest(),
      });
    expect((await send('https://evil.example')).status).toBe(403);
    expect((await send('null')).status).toBe(403);
    expect(ai).not.toHaveBeenCalled();
  });
  it('shares one daily allowance across everyone', async () => {
    const send = (host) =>
      call(port, {
        method: 'POST',
        path: '/api/chat',
        host,
        origin: `https://${host}`,
        body: chatRequest(),
      });
    expect((await send('seite.vercel.app')).status).toBe(200);
    expect((await send('seite.vercel.app')).status).toBe(200);
    const blocked = await send('seite.vercel.app');
    expect(blocked.status).toBe(429);
    expect(blocked.body.error).toMatch(/This demo has used all 2 AI messages/);
  });
  it('does not serve files', async () => {
    expect(
      (await call(port, { path: '/index.html', host: 'seite.vercel.app' })).status,
    ).toBe(404);
  });
});

describe('usage limiters', () => {
  it('memory limiter allows up to the limit then reports the wait', async () => {
    let time = 0;
    const limiter = createMemoryLimiter(() => time);
    expect((await limiter.hit('a', 2, 1000)).allowed).toBe(true);
    time = 100;
    expect((await limiter.hit('a', 2, 1000)).allowed).toBe(true);
    const blocked = await limiter.hit('a', 2, 1000);
    expect(blocked).toEqual({ allowed: false, retryAfterMs: 900 });
    time = 1001;
    expect((await limiter.hit('a', 2, 1000)).allowed).toBe(true);
  });
  it('shared limiter counts through Upstash and respects the limit', async () => {
    let count = 0;
    const fetchImpl = vi.fn(async () => {
      count += 1;
      return {
        ok: true,
        json: async () => [{ result: count }, { result: 1 }, { result: 5000 }],
      };
    });
    const limiter = createUpstashLimiter(
      { url: 'https://x.upstash.io/', token: 't' },
      fetchImpl,
    );
    expect((await limiter.hit('k', 2, 86400000)).allowed).toBe(true);
    expect((await limiter.hit('k', 2, 86400000)).allowed).toBe(true);
    expect(await limiter.hit('k', 2, 86400000)).toEqual({
      allowed: false,
      retryAfterMs: 5000,
    });
    expect(fetchImpl.mock.calls[0][0]).toBe('https://x.upstash.io/pipeline');
    expect(fetchImpl.mock.calls[0][1].headers.Authorization).toBe('Bearer t');
  });
  it('falls back to memory when the shared counter fails, and when none is set', async () => {
    const failing = vi.fn().mockRejectedValue(new Error('down'));
    const limiter = createLimiter(
      { KV_REST_API_URL: 'https://x', KV_REST_API_TOKEN: 't' },
      failing,
    );
    expect((await limiter.hit('k', 1, 1000)).allowed).toBe(true);
    expect((await limiter.hit('k', 1, 1000)).allowed).toBe(false);
    expect((await createLimiter({}).hit('k', 1, 1000)).allowed).toBe(true);
  });
});
