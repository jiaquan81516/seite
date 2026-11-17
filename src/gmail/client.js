import { gmailReplySchema } from '../../shared/gmail-item';

const UNREACHABLE =
  'Couldn’t reach your Gmail script. Check the URL is a Web app deployment with access set to Anyone, then try again.';

async function call(url, init, fetchImpl = fetch) {
  let response;
  try {
    response = await fetchImpl(url, {
      redirect: 'follow',
      credentials: 'omit',
      cache: 'no-store',
      signal: AbortSignal.timeout(25_000),
      ...init,
    });
  } catch {
    throw new Error(UNREACHABLE);
  }
  let reply;
  try {
    reply = gmailReplySchema.parse(await response.json());
  } catch {
    // A Google sign-in page or an error page instead of JSON.
    throw new Error(UNREACHABLE);
  }
  if (!reply.ok)
    throw new Error(
      reply.error === 'unauthorised'
        ? 'That sync key doesn’t match the one in your script.'
        : 'Your Gmail script returned an error. Check its logs in Apps Script.',
    );
  return reply;
}

const query = (settings, action) =>
  `${settings.url}?action=${action}&key=${encodeURIComponent(settings.key)}`;

export async function pingGmail(settings, fetchImpl) {
  const reply = await call(query(settings, 'ping'), {}, fetchImpl);
  return { pending: reply.pending ?? 0, lastSync: reply.last_sync ?? null };
}

export async function fetchPendingGmail(settings, fetchImpl) {
  const reply = await call(query(settings, 'pending'), {}, fetchImpl);
  return {
    items: reply.items ?? [],
    remaining: reply.remaining ?? 0,
    lastSync: reply.last_sync ?? null,
  };
}

// text/plain keeps this a "simple" request, so the browser needs no CORS preflight.
export async function ackGmail(settings, ids, fetchImpl) {
  await call(
    settings.url,
    {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'ack', key: settings.key, ids }),
    },
    fetchImpl,
  );
}
