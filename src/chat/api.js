import { aiReplySchema } from '../../shared/ai-schema';
async function jsonResponse(response) {
  let body;
  try {
    body = await response.json();
  } catch {
    throw new Error(
      'The AI server could not be reached. Start npm run dev, including the API server.',
    );
  }
  if (!response.ok)
    throw new Error(body.error || 'The request failed. Please try again.');
  return body;
}
export async function sendChat(request, signal) {
  const body = await jsonResponse(
    await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
      signal,
    }),
  );
  return { ...aiReplySchema.parse(body), provider: body.provider, model: body.model };
}
export async function getAiStatus() {
  return jsonResponse(await fetch('/api/ai/status'));
}
export async function fetchExchangeRate(currency, signal) {
  return jsonResponse(
    await fetch(`/api/fx?from=${encodeURIComponent(currency)}`, { signal }),
  );
}
