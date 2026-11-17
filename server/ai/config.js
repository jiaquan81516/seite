const GEMINI_FREE_MODELS = new Set([
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
]);

export function loadAiConfig(env = process.env) {
  const geminiModel = env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
  const routerModel = env.OPENROUTER_MODEL || 'openrouter/free';
  if (!GEMINI_FREE_MODELS.has(geminiModel))
    throw new Error(
      'GEMINI_MODEL must be a model listed in server/ai/config.js after verifying its free tier.',
    );
  if (routerModel !== 'openrouter/free' && !routerModel.endsWith(':free'))
    throw new Error('Only :free OpenRouter models or openrouter/free are allowed.');
  const cloudConfirmed = env.AI_FREE_TIER_CONFIRMED === 'true';
  return {
    providers: [
      {
        provider: 'gemini',
        model: geminiModel,
        apiKey: env.GEMINI_API_KEY || '',
        enabled: cloudConfirmed && Boolean(env.GEMINI_API_KEY),
      },
      {
        provider: 'groq',
        model: env.GROQ_MODEL || 'qwen/qwen3.8-27b',
        apiKey: env.GROQ_API_KEY || '',
        enabled: cloudConfirmed && Boolean(env.GROQ_API_KEY),
      },
      {
        provider: 'openrouter',
        model: routerModel,
        apiKey: env.OPENROUTER_API_KEY || '',
        enabled: cloudConfirmed && Boolean(env.OPENROUTER_API_KEY),
      },
    ],
    local: {
      provider: 'ollama',
      model: env.OLLAMA_MODEL || 'gemma3:4b',
      enabled: env.OLLAMA_ENABLED === 'true',
    },
    cloudConfirmed,
  };
}

export function publicAiStatus(config) {
  return {
    defaultMode: 'cloud',
    cloud: config.providers.map(({ provider, model, enabled }) => ({
      provider,
      model,
      configured: enabled,
    })),
    local: { model: config.local.model, configured: config.local.enabled },
    setup: config.cloudConfirmed
      ? 'Add a provider key to the server-only .env file.'
      : 'Configure a free-tier project key and AI_FREE_TIER_CONFIRMED=true in .env.',
  };
}
