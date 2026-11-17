import { afterEach, describe, expect, it, vi } from 'vitest';
import { aiClient, callProvider } from '../../server/ai/client';
import { loadAiConfig, publicAiStatus } from '../../server/ai/config';
import { aiReply, chatRequest } from '../ai-fixtures';
const config = () =>
  loadAiConfig({
    AI_FREE_TIER_CONFIRMED: 'true',
    GEMINI_API_KEY: 'test-key-never-public',
    GROQ_API_KEY: 'test-groq',
    OPENROUTER_API_KEY: 'test-router',
    OLLAMA_ENABLED: 'true',
  });
afterEach(() => vi.unstubAllGlobals());
describe('AI routing and privacy', () => {
  it('returns a bounded action proposal using an actual supplied saved-entry ID', async () => {
    const request = chatRequest({
      text: 'Remove the cafe log',
      context: {
        today: '2026-11-17',
        facts: [],
        candidates: [],
        recent: [
          {
            id: 'cafe',
            merchant: 'Cafe',
            date: '2026-06-19',
            amount_cents: 1170,
            category: 'Food & Drink',
          },
        ],
      },
    });
    const result = await aiClient({
      config: config(),
      request,
      call: async () => ({
        model: 'test',
        output: aiReply({
          kind: 'action',
          reply: 'Already deleted!',
          transactions: [],
          action: { type: 'delete', target_id: 'cafe', changes: null },
        }),
      }),
      log: vi.fn(),
    });
    expect(result.action.target_id).toBe('cafe');
    expect(result.reply).toContain('Review');
    expect(result.reply).not.toContain('Already deleted');
    expect(result.transactions).toEqual([]);
  });
  it.each([
    ['invented ID', { text: 'Remove that log' }, 'invented'],
    [
      'receipt instructions',
      { text: 'Read this receipt', image: { mediaType: 'image/jpeg', data: 'aW1hZ2U=' } },
      null,
    ],
    ['unrequested mutation', { text: 'How much did I spend?' }, null],
  ])('does not offer an action from %s', async (_, overrides, targetId) => {
    const result = await aiClient({
      config: config(),
      request: chatRequest(overrides),
      call: async () => ({
        model: 'test',
        output: aiReply({
          kind: 'action',
          transactions: [],
          action: { type: 'delete', target_id: targetId, changes: null },
        }),
      }),
      log: vi.fn(),
    });
    expect(result.kind).toBe('clarification');
    expect(result.action).toBeNull();
  });
  it('falls back after a primary rate limit and records only model metadata', async () => {
    const call = vi
      .fn()
      .mockRejectedValueOnce(
        Object.assign(new Error('Rate limited'), { statusCode: 429 }),
      )
      .mockResolvedValueOnce({ output: aiReply(), model: 'fallback-model' });
    const log = vi.fn();
    const result = await aiClient({
      config: config(),
      request: chatRequest(),
      call,
      log,
    });
    expect(call.mock.calls.map(([provider]) => provider.provider)).toEqual([
      'gemini',
      'groq',
    ]);
    expect(result.provider).toBe('groq');
    expect(log.mock.calls.flat().join(' ')).not.toContain('test-key-never-public');
    expect(log.mock.calls.flat().join(' ')).not.toContain('Read this receipt');
  });
  it('never sends sensitive content to cloud, even after a local failure', async () => {
    const call = vi
      .fn()
      .mockRejectedValue(Object.assign(new Error('Down'), { statusCode: 503 }));
    await expect(
      aiClient({
        config: config(),
        request: chatRequest({ sensitive: true, cloudConsent: false }),
        call,
        log: vi.fn(),
      }),
    ).rejects.toThrow();
    expect(call).toHaveBeenCalledOnce();
    expect(call.mock.calls[0][0].provider).toBe('ollama');
  });
  it('blocks cloud requests without consent or unpaid-tier configuration', async () => {
    const call = vi.fn();
    await expect(
      aiClient({ config: config(), request: chatRequest({ cloudConsent: false }), call }),
    ).rejects.toThrow(/privacy/);
    await expect(
      aiClient({
        config: loadAiConfig({ GEMINI_API_KEY: 'test' }),
        request: chatRequest(),
        call,
      }),
    ).rejects.toThrow(/not configured/);
    expect(call).not.toHaveBeenCalled();
  });
  it('does not use cloud fallback providers when the user turns fallbacks off', async () => {
    const unavailablePrimary = loadAiConfig({
      AI_FREE_TIER_CONFIRMED: 'true',
      GROQ_API_KEY: 'test',
    });
    const call = vi.fn();
    await expect(
      aiClient({
        config: unavailablePrimary,
        request: chatRequest({ allowFallback: false }),
        call,
      }),
    ).rejects.toThrow(/not configured/);
    expect(call).not.toHaveBeenCalled();
  });
  it('replaces invented answer amounts with the app-calculated fact', async () => {
    const call = vi.fn().mockResolvedValue({
      output: aiReply({
        kind: 'answer',
        reply: 'You spent $999999.',
        answer_fact_id: 'Week:total',
      }),
      model: 'test-model',
    });
    const request = chatRequest({
      context: {
        today: '2026-11-17',
        facts: [{ id: 'Week:total', text: 'You spent S$9.20 this week.' }],
        recent: [],
        candidates: [],
      },
    });
    const result = await aiClient({ config: config(), request, call, log: vi.fn() });
    expect(result.reply).toBe('You spent S$9.20 this week.');
    expect(result.transactions).toEqual([]);
  });
  it('rejects paid OpenRouter routes and never exposes provider keys in status', () => {
    expect(() => loadAiConfig({ OPENROUTER_MODEL: 'paid/model' })).toThrow(/free/);
    expect(JSON.stringify(publicAiStatus(config()))).not.toContain('test-key');
  });
});
describe('installed SDK request formats', () => {
  it('sends Gemini native JSON schema and decodes a structured response', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          candidates: [
            {
              content: { role: 'model', parts: [{ text: JSON.stringify(aiReply()) }] },
              finishReason: 'STOP',
            },
          ],
          modelVersion: 'gemini-test-version',
          usageMetadata: {
            promptTokenCount: 12,
            candidatesTokenCount: 80,
            totalTokenCount: 92,
          },
        }),
        { headers: { 'Content-Type': 'application/json' } },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);
    const result = await callProvider(config().providers[0], chatRequest());
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.generationConfig.responseMimeType).toBe('application/json');
    expect(JSON.stringify(body.generationConfig.responseJsonSchema)).not.toMatch(
      /maxLength|maxItems|minimum|maximum/,
    );
    expect(body.generationConfig.responseJsonSchema).toHaveProperty(
      'properties.transactions',
    );
    expect(result.output.transactions[0].amount).toBe(9.2);
  });
  it('uses JSON-object mode for Groq with the schema grounded in the prompt', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 'test',
          created: 1,
          model: 'qwen-test',
          choices: [
            {
              index: 0,
              finish_reason: 'stop',
              message: { role: 'assistant', content: JSON.stringify(aiReply()) },
            },
          ],
          usage: { prompt_tokens: 12, completion_tokens: 80, total_tokens: 92 },
        }),
        { headers: { 'Content-Type': 'application/json' } },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);
    const result = await callProvider(config().providers[1], chatRequest());
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.response_format.type).toBe('json_object');
    expect(body.messages[0].content).toContain('Required JSON shape');
    expect(result.output.transactions).toHaveLength(1);
  });
});

describe('bulk removal proposals from the model', () => {
  const noFilter = {
    category: null,
    method: null,
    merchant: null,
    date_from: null,
    date_to: null,
  };
  const reply = (filter, extra = {}) =>
    aiReply({
      kind: 'action',
      transactions: [],
      action: {
        type: 'bulk_delete',
        target_id: null,
        changes: null,
        filter: { ...noFilter, ...filter },
        ...extra,
      },
    });
  const run = (text, output, overrides = {}) =>
    aiClient({
      config: config(),
      request: chatRequest({ text, ...overrides }),
      call: async () => ({ model: 'test', output }),
      log: vi.fn(),
    });
  it('passes a filter-based proposal through for review', async () => {
    const result = await run(
      'delete all my transport spending',
      reply({ category: 'Transport' }),
    );
    expect(result.kind).toBe('action');
    expect(result.action.filter.category).toBe('Transport');
    expect(result.reply).toContain('Untick');
  });
  it.each([
    ['an empty filter', 'delete everything', reply({})],
    [
      'a request that is not a removal',
      'show my transport',
      reply({ category: 'Transport' }),
    ],
    [
      'a bulk action carrying an entry ID',
      'delete transport',
      {
        ...reply({ category: 'Transport' }),
        action: { ...reply({ category: 'Transport' }).action, target_id: 'x' },
      },
    ],
  ])('turns %s into a clarification', async (_, text, output) => {
    const result = await run(text, output);
    expect(result.kind).toBe('clarification');
    expect(result.action).toBeNull();
  });
  it('never accepts a bulk action driven by an attached image', async () => {
    const result = await run('delete transport', reply({ category: 'Transport' }), {
      image: { mediaType: 'image/jpeg', data: 'aW1hZ2U=' },
    });
    expect(result.action).toBeNull();
  });
});

describe('app help answers', () => {
  const run = (output) =>
    aiClient({
      config: config(),
      request: chatRequest({ text: 'how do I back up my data?' }),
      call: async () => ({ model: 'test', output }),
      log: vi.fn(),
    });
  it('passes a guide-based help reply through without data or actions', async () => {
    const result = await run(
      aiReply({
        kind: 'help',
        reply: 'Open Your data and choose Download JSON backup.',
        action: {
          type: 'delete',
          target_id: null,
          changes: null,
        },
      }),
    );
    expect(result.kind).toBe('help');
    expect(result.reply).toContain('Your data');
    expect(result.transactions).toEqual([]);
    expect(result.action).toBeNull();
  });
  it('teaches the model the real pages, limits and features', async () => {
    const { SYSTEM_PROMPT } = await import('../../server/ai/prompt');
    for (const phrase of [
      '#/tracker',
      'Download JSON backup',
      'NOT AVAILABLE YET',
      'Direct bank connections',
      'Delete all local data',
      'Food & Drink',
    ])
      expect(SYSTEM_PROMPT).toContain(phrase);
  });
});
