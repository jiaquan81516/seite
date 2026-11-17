import { useEffect, useRef, useState } from 'react';
import { entryStorage } from '../lib/storage';
import { ackPending, currentConnection, fetchPending } from '../gmail/source';
import { planGmailImport } from '../gmail/import';
import { appendCompletion, entryLabel } from './completion-messages';
import { prepareCandidates } from './review';
import { loadMerchantRules, saveConversation, saveReviewedEntries } from './storage';

const INTERVAL_MS = 10 * 60 * 1000;
const STALE_SCRIPT_MS = 2 * 3600 * 1000;

export function gmailAddedText(entries) {
  const shown = entries.slice(0, 5).map(entryLabel).join(', ');
  const more = entries.length > 5 ? `, and ${entries.length - 5} more` : '';
  return `Added ${entries.length} ${entries.length === 1 ? 'spend' : 'spends'} from Gmail: ${shown}${more}. Ask me to delete or edit any that look wrong.`;
}

function skippedText(skipped) {
  return skipped.notExpense
    ? `${skipped.notExpense} other ${skipped.notExpense === 1 ? 'email was' : 'emails were'} a refund, income or transfer and wasn’t logged.`
    : '';
}

// Collects emails the Gmail script has parsed and saves them. It lives with the
// chat because the chat owns the conversation history that records what happened.
export function useGmailSync({
  ready,
  messages,
  setMessages,
  setEntries,
  activity,
  setActivity,
}) {
  const [gmail, setGmail] = useState({
    connected: Boolean(currentConnection()),
    demo: currentConnection()?.mode === 'demo',
    syncing: false,
    checkedAt: null,
    scriptStale: false,
    error: '',
  });
  const latest = useRef({});
  latest.current = { messages, activity };
  const running = useRef(false);

  async function sync() {
    const connection = currentConnection();
    if (!connection) {
      setGmail((state) => ({ ...state, connected: false, demo: false }));
      return;
    }
    if (running.current || latest.current.activity) return;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
    running.current = true;
    setGmail((state) => ({
      ...state,
      connected: true,
      demo: connection.mode === 'demo',
      syncing: true,
      error: '',
    }));
    try {
      const { items, lastSync } = await fetchPending(connection);
      let skippedNote = '';
      if (items.length) {
        const records = await entryStorage.load();
        const current = latest.current.messages;
        const plan = planGmailImport(items, records, current);
        const rules = await loadMerchantRules();
        let next = current;
        if (plan.auto.length)
          next = appendCompletion(next, {
            key: `gmail:${plan.auto
              .map((entry) => entry.external_ref)
              .sort()
              .join(',')}`,
            text: `${connection.mode === 'demo' ? 'Demo: ' : ''}${gmailAddedText(plan.auto)} ${skippedText(plan.skipped)}`.trim(),
          });
        if (plan.review.length)
          next = [
            ...next,
            {
              id: crypto.randomUUID(),
              role: 'assistant',
              sensitive: false,
              text: `${connection.mode === 'demo' ? 'Demo: ' : ''}${plan.review.length} Gmail ${plan.review.length === 1 ? 'transaction needs' : 'transactions need'} a quick check before saving.`,
              created_at: new Date().toISOString(),
              provider: 'Gmail',
              model: 'Apps Script',
              candidates: prepareCandidates(plan.review, rules).map((candidate) => ({
                ...candidate,
                sensitive: false,
              })),
            },
          ];
        skippedNote = skippedText(plan.skipped);
        // Block other writes while the entries and the chat save together.
        setActivity('saving');
        try {
          if (plan.auto.length)
            await saveReviewedEntries({ records: plan.auto, rules: [], messages: next });
          else if (next !== current) await saveConversation(next);
          if (next !== current) setMessages(next);
          setEntries(await entryStorage.load());
        } finally {
          setActivity('');
        }
        // Only forget the emails once they are safely stored here. A failed
        // acknowledgement just means they are offered again and de-duplicated.
        if (plan.ackIds.length) await ackPending(connection, plan.ackIds);
      }
      const scriptStale =
        !lastSync || Date.now() - Date.parse(lastSync) > STALE_SCRIPT_MS;
      setGmail((state) => ({
        ...state,
        syncing: false,
        checkedAt: new Date().toISOString(),
        scriptStale,
        skippedNote,
      }));
    } catch (failure) {
      setGmail((state) => ({
        ...state,
        syncing: false,
        error: failure.message || 'Gmail could not be checked. Nothing was changed.',
      }));
    } finally {
      running.current = false;
    }
  }

  const syncRef = useRef(sync);
  syncRef.current = sync;
  useEffect(() => {
    if (!ready) return undefined;
    const run = () => syncRef.current();
    run();
    const timer = setInterval(run, INTERVAL_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') run();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [ready]);

  return { gmail, syncGmail: sync };
}
