import { describeAiFailure } from './failure.js';
import { geminiOutputSchema } from './output-schema.js';
import { verifyLocalModel } from './local-model.js';
import { generateText, Output } from 'ai';
import { z } from 'zod';
import { redactSensitiveText } from '../../shared/privacy.js';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { aiReplySchema, hasBulkCriteria } from '../../shared/ai-schema.js';
import { SYSTEM_PROMPT, buildMessages } from './prompt.js';

export class AiServiceError extends Error {
  constructor(message, status = 503, code = 'ai_unavailable') {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function providerModel(config) {
  if (config.provider === 'gemini')
    return createGoogleGenerativeAI({ apiKey: config.apiKey })(config.model);
  const endpoints = {
    groq: 'https://api.groq.com/openai/v1',
    openrouter: 'https://openrouter.ai/api/v1',
    ollama: 'http://127.0.0.1:11434/v1',
  };
  return createOpenAICompatible({
    name: config.provider,
    baseURL: endpoints[config.provider],
    apiKey: config.apiKey || undefined,
    supportsStructuredOutputs: config.provider === 'ollama',
  }).chatModel(config.model);
}

export async function callProvider(config, request, signal) {
  if (config.provider === 'ollama') {
    try {
      await verifyLocalModel(config.model, signal);
    } catch {
      throw new AiServiceError(
        'Local mode needs downloaded vision-model weights in Ollama. Cloud-proxied Ollama models are not allowed. Nothing was sent to a cloud provider.',
      );
    }
  }
  const result = await generateText({
    model: providerModel(config),
    system:
      config.provider === 'groq' || config.provider === 'openrouter'
        ? `${SYSTEM_PROMPT}\nRequired JSON shape: ${JSON.stringify(z.toJSONSchema(aiReplySchema))}`
        : SYSTEM_PROMPT,
    messages: buildMessages(request),
    output: ['groq', 'openrouter'].includes(config.provider)
      ? Output.json()
      : Output.object({
          schema: config.provider === 'gemini' ? geminiOutputSchema : aiReplySchema,
        }),
    maxOutputTokens: 4096,
    maxRetries: 0,
    abortSignal: signal,
  });
  return { output: result.output, model: result.response.modelId || config.model };
}

export async function aiClient({
  config,
  request,
  signal,
  call = callProvider,
  log = console.info,
}) {
  const localOnly = request.sensitive || request.mode === 'local';
  if (!localOnly && !request.cloudConsent)
    throw new AiServiceError('Review the cloud privacy notice before sending.', 422);
  const available = localOnly
    ? [config.local].filter((item) => item.enabled)
    : config.providers.filter((item) => item.enabled);
  const chain =
    request.allowFallback || localOnly
      ? available
      : available.filter((item) => item.provider === 'gemini');
  if (!chain.length)
    throw new AiServiceError(
      localOnly
        ? 'Local Ollama is not configured. Enable it in the server .env and install a vision model. Nothing was sent to a cloud model.'
        : 'AI is not configured yet. Add a free-tier Gemini key to the server .env file.',
    );
  let lastFailure;
  for (const provider of chain) {
    try {
      const timeout = AbortSignal.timeout(localOnly ? 120_000 : 40_000);
      const result = await call(
        provider,
        request,
        signal ? AbortSignal.any([signal, timeout]) : timeout,
      );
      const output = aiReplySchema.parse(result.output);
      output.reply = redactSensitiveText(output.reply);
      output.transactions = output.transactions.map((item) => ({
        ...item,
        merchant: item.merchant ? redactSensitiveText(item.merchant) : null,
        notes: redactSensitiveText(item.notes),
      }));
      // A provider can only propose an allowlisted action on supplied saved IDs.
      // The browser owns review, validation and the eventual storage transaction.
      if (output.kind === 'action') {
        const action = output.action;
        const permitted =
          !request.image &&
          /\b(remove|delete|undo|change|edit|update|rename|correct|set|mark|make)\b/i.test(
            request.text,
          ) &&
          action &&
          (action.type === 'bulk_delete'
            ? action.target_id === null &&
              !action.changes &&
              hasBulkCriteria(action.filter) &&
              /\b(remove|delete|clear|undo)\b/i.test(request.text)
            : action.target_id === null ||
              request.context.recent.some((entry) => entry.id === action.target_id));
        output.transactions = [];
        output.correction = null;
        if (!permitted) {
          output.kind = 'clarification';
          output.action = null;
          output.reply =
            'Which saved entry would you like to change, and what should change?';
        } else {
          if (action.changes?.merchant)
            action.changes.merchant = redactSensitiveText(action.changes.merchant);
          if (action.changes?.note)
            action.changes.note = redactSensitiveText(action.changes.note);
          output.reply =
            action.type === 'bulk_delete'
              ? 'Review the matching entries below. Untick any you want to keep, then confirm or cancel.'
              : action.type === 'delete'
                ? 'Review the entry below, then choose Remove entry or Cancel.'
                : 'Review the proposed changes below, then choose Apply changes or Cancel.';
        }
      } else output.action = null;
      if (output.kind === 'help') {
        output.transactions = [];
        output.correction = null;
        output.answer_fact_id = null;
      }
      // Financial answers use a fact calculated by the app, never a model-created number.
      if (output.kind === 'answer') {
        const fact = request.context.facts.find(
          (item) => item.id === output.answer_fact_id,
        );
        output.reply =
          fact?.text ||
          'I don’t have enough saved information to answer that. Try a day, week or month spending question.';
        output.transactions = [];
        output.correction = null;
      }
      log(
        JSON.stringify({
          event: 'ai_response',
          provider: provider.provider,
          model: result.model,
        }),
      );
      return { ...output, provider: provider.provider, model: result.model };
    } catch (error) {
      if (error instanceof AiServiceError) throw error;
      if (signal?.aborted) throw new AiServiceError('Request cancelled.', 499);
      lastFailure = describeAiFailure(error, provider.provider);
      log(
        JSON.stringify({
          event: 'ai_attempt_failed',
          provider: provider.provider,
          status: error.statusCode || lastFailure.status,
          code: lastFailure.code,
        }),
      );
      if (!lastFailure.retryable || provider === chain.at(-1)) break;
    }
  }
  throw new AiServiceError(lastFailure.message, lastFailure.status, lastFailure.code);
}
