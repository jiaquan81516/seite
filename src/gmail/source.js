import { ackGmail, fetchPendingGmail } from './client';
import { demoAck, demoFetchPending, isDemoMode } from './demo';
import { loadGmailSettings } from './settings';

// Where emails come from: the user's own Gmail script, or simulated demo emails.
export function currentConnection() {
  if (isDemoMode()) return { mode: 'demo' };
  const settings = loadGmailSettings();
  return settings ? { mode: 'live', ...settings } : null;
}

export async function fetchPending(connection) {
  return connection.mode === 'demo' ? demoFetchPending() : fetchPendingGmail(connection);
}

export async function ackPending(connection, ids) {
  if (connection.mode === 'demo') demoAck(ids);
  else await ackGmail(connection, ids);
}
