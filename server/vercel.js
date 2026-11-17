import { loadAiConfig } from './ai/config.js';
import { DAILY_MESSAGE_LIMIT, createHandler } from './http.js';
import { createLimiter } from './limiter.js';

// One handler for every /api route when Seite runs on Vercel. Keys come from the
// project's environment variables, never from the browser. Private on-device AI
// (Ollama) cannot run in the cloud, so it is always off here.
export default createHandler(loadAiConfig({ ...process.env, OLLAMA_ENABLED: 'false' }), {
  hosted: true,
  limiter: createLimiter(process.env),
  dailyLimit: Number(process.env.CHAT_DAILY_LIMIT) || DAILY_MESSAGE_LIMIT,
});
