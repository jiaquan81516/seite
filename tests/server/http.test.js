import { createServer } from 'node:http';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createHandler } from '../../server/http';
import { loadAiConfig } from '../../server/ai/config';
import { aiReply, chatRequest } from '../ai-fixtures';
let server;
let base;
const ai = vi.fn().mockResolvedValue(aiReply());
beforeAll(async () => {
  server = createServer(
    createHandler(loadAiConfig({ GEMINI_API_KEY: 'never-expose-test-key' }), { ai }),
  );
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
});
describe('local AI API', () => {
  it('reports setup status without exposing keys', async () => {
    const response = await fetch(`${base}/api/ai/status`);
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(JSON.stringify(body)).not.toContain('never-expose-test-key');
    expect(body.cloud[0].configured).toBe(false);
  });
  it('accepts a validated request and returns structured JSON', async () => {
    const response = await fetch(`${base}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(chatRequest()),
    });
    expect(response.status).toBe(200);
    expect((await response.json()).transactions).toHaveLength(1);
  });
  it('blocks cross-origin requests before calling a provider', async () => {
    const calls = ai.mock.calls.length;
    const response = await fetch(`${base}/api/chat`, {
      method: 'POST',
      headers: {
        Origin: 'https://untrusted.example',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(chatRequest()),
    });
    expect(response.status).toBe(403);
    expect(ai.mock.calls).toHaveLength(calls);
  });
  it('rejects raw PDFs and malformed payloads', async () => {
    const response = await fetch(`${base}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(
        chatRequest({ image: { mediaType: 'application/pdf', data: 'cGRm' } }),
      ),
    });
    expect(response.status).toBe(400);
  });
  it('never serves the .env file', async () => {
    expect((await fetch(`${base}/.env`)).status).toBe(404);
  });
});

describe('daily message limit', () => {
  it('stops AI messages after the daily limit and frees them after 24 hours', async () => {
    let time = 1_000_000;
    const limited = createServer(
      createHandler(loadAiConfig({}), {
        ai: vi.fn().mockResolvedValue(aiReply()),
        dailyLimit: 3,
        now: () => time,
      }),
    );
    await new Promise((resolve) => limited.listen(0, '127.0.0.1', resolve));
    const url = `http://127.0.0.1:${limited.address().port}/api/chat`;
    const send = () =>
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(chatRequest()),
      });
    for (let index = 0; index < 3; index += 1) expect((await send()).status).toBe(200);
    const blocked = await send();
    expect(blocked.status).toBe(429);
    const body = await blocked.json();
    expect(body.code).toBe('daily_limit');
    expect(body.error).toMatch(/all 3 AI messages/);
    time += 24 * 60 * 60 * 1000 + 1;
    expect((await send()).status).toBe(200);
    await new Promise((resolve) => limited.close(resolve));
  });
  it('defaults to 100 messages a day', async () => {
    const { DAILY_MESSAGE_LIMIT } = await import('../../server/http');
    expect(DAILY_MESSAGE_LIMIT).toBe(100);
  });
});
