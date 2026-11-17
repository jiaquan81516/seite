import { describe, expect, it } from 'vitest';
import { describeAiFailure } from '../../server/ai/failure';

describe('safe, actionable AI errors', () => {
  it('identifies Gemini’s too-many-states response-format rejection', () => {
    const result = describeAiFailure(
      {
        statusCode: 400,
        message:
          'The specified schema produces a constraint that has too many states for serving.',
      },
      'gemini',
    );
    expect(result.code).toBe('response_schema_rejected');
    expect(result.message).toContain('response format');
    expect(result.retryable).toBe(false);
  });
  it('uses a quota retry delay without leaking the provider body', () => {
    const error = {
      statusCode: 429,
      responseBody: JSON.stringify({
        error: {
          message: 'secret-key private-project receipt-content',
          details: [
            { '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: '42.2s' },
          ],
        },
      }),
    };
    const result = describeAiFailure(error, 'gemini');
    expect(result.message).toContain('43 seconds');
    expect(JSON.stringify(result)).not.toMatch(
      /secret-key|private-project|receipt-content/,
    );
    expect(result.status).toBe(429);
  });
  it.each([
    [401, 'provider_access_denied'],
    [403, 'provider_access_denied'],
    [404, 'provider_model_unavailable'],
    [503, 'provider_unavailable'],
  ])('classifies provider status %s', (statusCode, code) => {
    expect(describeAiFailure({ statusCode }, 'gemini').code).toBe(code);
  });
  it('distinguishes timeout and truncated output from ordinary availability errors', () => {
    expect(describeAiFailure({ name: 'TimeoutError' }, 'gemini').code).toBe(
      'provider_timeout',
    );
    expect(
      describeAiFailure(
        { name: 'AI_NoObjectGeneratedError', finishReason: 'length' },
        'gemini',
      ).code,
    ).toBe('response_truncated');
  });
});
