function providerErrorBody(error) {
  try {
    return JSON.parse(error.responseBody || '{}').error || {};
  } catch {
    return {};
  }
}

export function describeAiFailure(error, provider) {
  const wrapped = [error, error.cause, error.cause?.cause].filter(Boolean);
  const source = wrapped.find((item) => Number.isInteger(item.statusCode)) || error;
  const status = source.statusCode;
  const body = providerErrorBody(source);
  // Inspect diagnostic text only to classify it. Never return or log raw bodies:
  // provider errors can contain request content, keys or project identifiers.
  const diagnostic = `${source.message || ''} ${body.message || ''}`;
  const name =
    provider === 'gemini'
      ? 'Gemini'
      : provider === 'groq'
        ? 'Groq'
        : provider === 'openrouter'
          ? 'OpenRouter'
          : 'Ollama';

  if (status === 400 && /schema|constraint.*states/i.test(diagnostic)) {
    return {
      code: 'response_schema_rejected',
      status: 502,
      retryable: false,
      message: `${name} rejected the app’s response format. Update or restart the AI server, then retry. Nothing was added.`,
    };
  }
  if (status === 429) {
    const retry = body.details?.find((item) =>
      item['@type']?.endsWith('RetryInfo'),
    )?.retryDelay;
    const seconds =
      typeof retry === 'string' && /^\d+(?:\.\d+)?s$/.test(retry)
        ? Math.min(3600, Math.ceil(Number.parseFloat(retry)))
        : null;
    return {
      code: 'provider_rate_limited',
      status: 429,
      retryable: true,
      message: `${name}’s free quota is exhausted or unavailable for this model/project. ${seconds ? `Wait at least ${seconds} seconds, then retry.` : 'Wait for the quota to reset, or check this project’s free-tier limits.'} Nothing was added.`,
    };
  }
  if (status === 401 || status === 403) {
    return {
      code: 'provider_access_denied',
      status: 502,
      retryable: false,
      message: `${name} rejected the server key or model access. Check the key, project permissions and regional availability. Nothing was added.`,
    };
  }
  if (status === 404) {
    return {
      code: 'provider_model_unavailable',
      status: 503,
      retryable: true,
      message: `The configured ${name} model is unavailable to this project. Choose an accessible free model in the server configuration. Nothing was added.`,
    };
  }
  if (
    wrapped.some((item) => ['TimeoutError', 'AbortError'].includes(item.name)) ||
    status === 408
  ) {
    return {
      code: 'provider_timeout',
      status: 504,
      retryable: true,
      message: `${name} took too long to reply. Retry with a smaller crop or fewer transactions. Nothing was added.`,
    };
  }
  if (error.finishReason === 'length') {
    return {
      code: 'response_truncated',
      status: 502,
      retryable: true,
      message:
        'The AI reply was cut short. Try a smaller crop or fewer transactions. Nothing was added.',
    };
  }
  if (
    ['AI_NoObjectGeneratedError', 'AI_NoOutputGeneratedError', 'ZodError'].includes(
      error.name,
    )
  ) {
    return {
      code: 'invalid_ai_response',
      status: 502,
      retryable: true,
      message:
        'The AI reply could not be validated as receipt data. Try a clearer crop or send fewer transactions. Nothing was added.',
    };
  }
  if (status === 400 || status === 413 || status === 415) {
    return {
      code: 'provider_request_rejected',
      status: 422,
      retryable: false,
      message: `${name} couldn’t accept this attachment or request. Try a clear JPG/PNG screenshot or a smaller crop. Nothing was added.`,
    };
  }
  return {
    code: 'provider_unavailable',
    status: 503,
    retryable: status === undefined || status >= 500,
    message: `${name} is unavailable right now. Try again shortly. Nothing was added.`,
  };
}
