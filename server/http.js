import { readFile, stat } from 'node:fs/promises';
import { resolve, sep, extname } from 'node:path';
import { chatRequestSchema } from '../shared/ai-schema.js';
import { aiClient } from './ai/client.js';
import { publicAiStatus } from './ai/config.js';
import { getExchangeRate } from './fx.js';
import { createMemoryLimiter } from './limiter.js';

function json(response, status, body) {
  response.writeHead(status, {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  response.end(JSON.stringify(body));
}
async function readJson(request) {
  if (!request.headers['content-type']?.startsWith('application/json'))
    throw Object.assign(new Error('Send JSON to this endpoint.'), { status: 415 });
  // Some hosts (Vercel) parse the body before it reaches us.
  if (request.body && typeof request.body === 'object' && !Buffer.isBuffer(request.body))
    return request.body;
  const chunks = [];
  let bytes = 0;
  await new Promise((resolve, reject) => {
    let tooLarge = false;
    request.on('data', (chunk) => {
      bytes += chunk.length;
      if (bytes > 6_000_000) {
        tooLarge = true;
        return;
      }
      chunks.push(chunk);
    });
    request.on('end', () =>
      tooLarge
        ? reject(
            Object.assign(
              new Error('This upload is too large. Choose a smaller screenshot.'),
              { status: 413 },
            ),
          )
        : resolve(),
    );
    request.on('error', reject);
  });
  try {
    return JSON.parse(Buffer.concat(chunks).toString());
  } catch {
    throw Object.assign(new Error('The request is not valid JSON.'), { status: 400 });
  }
}
const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.mjs': 'text/javascript',
};

export const DAILY_MESSAGE_LIMIT = 100;
const DAY = 24 * 60 * 60 * 1000;

// hosted: running on a public host (Vercel) instead of on your own computer. It
// accepts requests for its own address only, and shares one daily allowance across
// everyone, so a public link can never spend more than the limit.
export function createHandler(
  config,
  {
    ai = aiClient,
    fx = getExchangeRate,
    dailyLimit = Number(process.env.CHAT_DAILY_LIMIT) || DAILY_MESSAGE_LIMIT,
    now = Date.now,
    hosted = false,
    limiter = createMemoryLimiter(now),
  } = {},
) {
  let active = 0;
  let requests = [];
  return async function handle(request, response) {
    const abort = new AbortController();
    response.on('close', () => {
      if (!response.writableEnded) abort.abort();
    });
    try {
      const url = new URL(request.url, 'http://localhost');
      const origin = request.headers.origin;
      const host = request.headers.host?.split(':')[0];
      if (hosted) {
        let originHost = '';
        try {
          originHost = origin ? new URL(origin).host : '';
        } catch {
          originHost = 'invalid';
        }
        if (origin && originHost !== request.headers.host)
          return json(response, 403, { error: 'This origin is not allowed.' });
      } else {
        if (!['localhost', '127.0.0.1'].includes(host))
          return json(response, 403, {
            error: 'This local server only accepts localhost requests.',
          });
        if (
          origin &&
          !/^http:\/\/(localhost|127\.0\.0\.1):(5173|4173|8787)$/.test(origin)
        )
          return json(response, 403, { error: 'This origin is not allowed.' });
      }
      if (url.pathname === '/api/ai/status' && request.method === 'GET')
        return json(response, 200, publicAiStatus(config));
      if (url.pathname === '/api/fx' && request.method === 'GET') {
        try {
          return json(response, 200, await fx(url.searchParams.get('from') || ''));
        } catch (error) {
          return json(response, 422, { error: error.message });
        }
      }
      if (url.pathname === '/api/chat' && request.method === 'POST') {
        const parsed = chatRequestSchema.safeParse(await readJson(request));
        if (!parsed.success)
          return json(response, 400, {
            error: 'Check the message or attachment and try again.',
          });
        requests = requests.filter((time) => Date.now() - time < 60000);
        if (active >= 2 || requests.length >= 10)
          return json(response, 429, {
            error: 'A little pause—please wait a minute before sending more requests.',
          });
        const client = hosted
          ? 'seite:daily:site'
          : request.socket.remoteAddress || 'local';
        const { allowed, retryAfterMs } = await limiter.hit(client, dailyLimit, DAY);
        if (!allowed) {
          const hours = Math.max(1, Math.ceil(retryAfterMs / 3600000));
          return json(response, 429, {
            code: 'daily_limit',
            error: `${hosted ? 'This demo has' : "You've"} used all ${dailyLimit} AI messages for today. They free up again in about ${hours} ${hours === 1 ? 'hour' : 'hours'}. Your tracker still works as usual.`,
          });
        }
        requests.push(Date.now());
        active += 1;
        try {
          return json(
            response,
            200,
            await ai({ config, request: parsed.data, signal: abort.signal }),
          );
        } finally {
          active -= 1;
        }
      }
      if (url.pathname.startsWith('/api/'))
        return json(response, 404, { error: 'API endpoint not found.' });
      if (hosted) return json(response, 404, { error: 'Not found.' });
      if (request.method !== 'GET')
        return json(response, 405, { error: 'Method not allowed.' });
      const directory = resolve('dist');
      const pathname = decodeURIComponent(url.pathname);
      if (pathname.split('/').some((part) => part.startsWith('.')))
        return json(response, 404, { error: 'Not found.' });
      const file = resolve(directory, pathname === '/' ? 'index.html' : `.${pathname}`);
      if (
        !file.startsWith(directory + sep) ||
        !(await stat(file).catch(() => null))?.isFile()
      )
        return json(response, 404, { error: 'Not found. Run npm run build first.' });
      response.writeHead(200, {
        'Content-Type': MIME[extname(file)] || 'application/octet-stream',
        'Cache-Control': 'no-cache',
        'X-Content-Type-Options': 'nosniff',
      });
      response.end(await readFile(file));
    } catch (error) {
      if (!response.headersSent)
        json(response, error.status || 500, {
          ...(error.code && error.status ? { code: error.code } : {}),
          error: error.status
            ? error.message
            : 'Something went wrong. Nothing was saved. Please try again.',
        });
      else response.end();
    }
  };
}
