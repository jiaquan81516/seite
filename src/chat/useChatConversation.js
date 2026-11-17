import { useEffect, useRef, useState } from 'react';
import { entryStorage } from '../lib/storage';
import { sendChat } from './api';
import { buildChatContext, redactSensitiveText } from './context';
import { prepareCandidates } from './review';
import { averageFactId, dateSpendingFact, spendingFactId } from './local-answer';
import { createActionProposal, isRecentRemoval, recentRemoval } from './entry-actions';
import { useEntryActions } from './useEntryActions';
import { useGmailSync } from './useGmailSync';
import { createBulkProposal } from './bulk-delete';
import { createRestoreProposal, findRestorable, isRestoreRequest } from './restore';
import { appendCompletion, entryLabel, savedEntriesText } from './completion-messages';
import {
  correctSavedCategory,
  loadConversation,
  loadMerchantRules,
  markOriginalRefunded,
  rememberMerchantRule,
  saveConversation,
  saveReviewedEntries,
} from './storage';

export function useChatConversation() {
  const [messages, setMessages] = useState([]);
  const [entries, setEntries] = useState([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [activity, setActivity] = useState('');
  const controller = useRef(null);
  const entryActions = useEntryActions({
    messages,
    setMessages,
    setEntries,
    activity,
    setActivity,
  });
  const gmailSync = useGmailSync({
    ready,
    messages,
    setMessages,
    setEntries,
    activity,
    setActivity,
  });
  useEffect(() => {
    let active = true;
    Promise.all([loadConversation(), entryStorage.load()])
      .then(([history, records]) => {
        if (active) {
          setMessages(history);
          setEntries(records);
          setReady(true);
        }
      })
      .catch(() => {
        if (active)
          setError(
            'Your local chat history could not be opened. Check browser storage and reload.',
          );
      });
    return () => {
      active = false;
      controller.current?.abort();
    };
  }, []);

  async function send(text, attachment, options) {
    if (!ready || activity) return false;
    setActivity('sending');
    setError('');
    const abort = new AbortController();
    controller.current = abort;
    let pending = messages;
    try {
      const records = await entryStorage.load();
      setEntries(records);
      const localFactId = !attachment && (spendingFactId(text) || averageFactId(text));
      const removeRecent = !attachment && isRecentRemoval(text);
      const restoreRequest =
        !attachment && !localFactId && !removeRecent && isRestoreRequest(text);
      const dateFact =
        !attachment &&
        !localFactId &&
        !removeRecent &&
        !restoreRequest &&
        dateSpendingFact(text, records);
      if (localFactId || dateFact || removeRecent || restoreRequest) {
        const fact =
          dateFact ||
          (localFactId &&
            buildChatContext(records, []).facts.find((item) => item.id === localFactId));
        const restorable = restoreRequest ? findRestorable(messages) : null;
        const action = restorable
          ? createRestoreProposal(restorable)
          : removeRecent
            ? recentRemoval(records)
            : null;
        // This answer never leaves the browser. Keep private totals out of future
        // cloud history, just like the private entries they were calculated from.
        const sensitive =
          options.sensitive ||
          options.mode === 'local' ||
          records.some((entry) => entry.sensitive);
        const next = [
          ...messages,
          {
            id: crypto.randomUUID(),
            role: 'user',
            text: redactSensitiveText(text),
            sensitive,
            created_at: new Date().toISOString(),
          },
          {
            id: crypto.randomUUID(),
            role: 'assistant',
            text: fact
              ? fact.text
              : restoreRequest
                ? action
                  ? 'Review the entries below, then choose Restore or Cancel.'
                  : 'There is no removal in this chat to restore. For older entries, open Your data and choose a downloaded JSON backup.'
                : action
                  ? 'Review the entry below, then choose Remove entry or Cancel.'
                  : 'There are no saved entries to remove.',
            sensitive,
            created_at: new Date().toISOString(),
            view: fact?.view,
            action,
            provider: 'On this device',
            model: 'Saved entries',
          },
        ];
        await saveConversation(next);
        setMessages(next);
        return true;
      }
      const privateMode = options.sensitive || options.mode === 'local';
      const contextMessages = privateMode
        ? messages
        : messages.filter((message) => !message.sensitive);
      const contextEntries = privateMode
        ? records
        : records.filter((entry) => !entry.sensitive);
      const excludedPrivateEntries = contextEntries.length !== records.length;
      const user = {
        id: crypto.randomUUID(),
        role: 'user',
        sensitive: privateMode,
        text: redactSensitiveText(text),
        attachmentName: attachment ? redactSensitiveText(attachment.name) : '',
        created_at: new Date().toISOString(),
      };
      pending = [...messages, user];
      await saveConversation(pending);
      setMessages(pending);
      const context = buildChatContext(contextEntries, contextMessages);
      if (excludedPrivateEntries) {
        context.facts = context.facts.map((fact) => ({
          ...fact,
          text: `Shared entries only. ${fact.text}`,
          view: { ...fact.view, excludeSensitive: true },
        }));
        context.request.facts = context.facts.map(({ id, text }) => ({ id, text }));
      }
      const requestContext = attachment
        ? { today: context.request.today, facts: [], recent: [], candidates: [] }
        : context.request;
      const result = await sendChat(
        {
          ...options,
          text: redactSensitiveText(text),
          image: attachment
            ? { mediaType: attachment.mediaType, data: attachment.data }
            : null,
          history: contextMessages.slice(-6).map((message) => ({
            role: message.role,
            text: redactSensitiveText(message.text).slice(0, 4000),
          })),
          context: requestContext,
        },
        abort.signal,
      );
      const rules = await loadMerchantRules();
      const fact = context.facts.find((item) => item.id === result.answer_fact_id);
      const validTargets = [...requestContext.recent, ...requestContext.candidates].map(
        (item) => item.id,
      );
      const action =
        !attachment && result.kind === 'action' && result.action?.type === 'bulk_delete'
          ? createBulkProposal(result.action, contextEntries)
          : !attachment && result.kind === 'action' && result.action
            ? createActionProposal(
                result.action,
                records.filter((entry) =>
                  requestContext.recent.some((item) => item.id === entry.id),
                ),
              )
            : null;
      const assistant = {
        id: crypto.randomUUID(),
        role: 'assistant',
        sensitive: privateMode,
        text: result.reply,
        created_at: new Date().toISOString(),
        provider: result.provider,
        model: result.model,
        action,
        candidates: prepareCandidates(result.transactions, rules).map((candidate) => ({
          ...candidate,
          sensitive: privateMode,
        })),
        view: result.kind === 'answer' ? fact?.view : null,
        correction:
          result.correction && validTargets.includes(result.correction.target_id)
            ? result.correction
            : null,
      };
      const next = [...pending, assistant];
      await saveConversation(next);
      setMessages(next);
      return true;
    } catch (error) {
      setError(
        abort.signal.aborted
          ? 'Request cancelled. Nothing was added to your tracker.'
          : error.message || 'That request could not be completed. Nothing was saved.',
      );
      return false;
    } finally {
      controller.current = null;
      setActivity('');
    }
  }

  async function saveReview(messageId, records, allowDuplicateIds, rules) {
    if (activity) throw new Error('Wait for the current request to finish.');
    setActivity('saving');
    try {
      const selected = new Set(records.map((record) => record.id));
      let next = messages.map((message) =>
        message.id === messageId
          ? {
              ...message,
              candidates: message.candidates.map((candidate) =>
                selected.has(candidate.id) ? { ...candidate, saved: true } : candidate,
              ),
            }
          : message,
      );
      await saveReviewedEntries({
        records,
        allowDuplicateIds,
        rules,
        messages: (savedIds) => {
          const saved = records.filter((record) => savedIds.includes(record.id));
          if (saved.length)
            next = appendCompletion(next, {
              key: `${messageId}:saved:${[...savedIds].sort().join(',')}`,
              text: savedEntriesText(saved),
              sensitive:
                saved.some((entry) => entry.sensitive) ||
                messages.find((message) => message.id === messageId)?.sensitive,
            });
          return next;
        },
      });
      setMessages(next);
      setEntries(await entryStorage.load());
    } finally {
      setActivity('');
    }
  }

  async function cancelReview(messageId) {
    if (activity) throw new Error('Wait for the current request to finish.');
    setActivity('saving');
    try {
      const next = messages.map((message) =>
        message.id === messageId
          ? {
              ...message,
              candidates: message.candidates.filter((candidate) => candidate.saved),
              reviewCancelled: true,
              correction: null,
            }
          : message,
      );
      await saveConversation(next);
      setMessages(next);
    } finally {
      setActivity('');
    }
  }

  async function applyCorrection(messageId, correction) {
    if (activity) return;
    setActivity('saving');
    setError('');
    try {
      let next = messages.map((message) =>
        message.id === messageId
          ? { ...message, correction: null, text: 'Category correction applied.' }
          : message,
      );
      let sensitive = messages.find((message) => message.id === messageId)?.sensitive;
      if (correction.target_id.startsWith('draft:')) {
        const id = correction.target_id.slice(6);
        const candidate = messages
          .flatMap((message) => message.candidates || [])
          .find((item) => item.id === id && !item.saved);
        if (!candidate?.merchant)
          throw new Error('Choose the merchant on that draft first.');
        sensitive ||= candidate.sensitive;
        next = next.map((message) => ({
          ...message,
          candidates: message.candidates?.map((item) =>
            item.id === id ? { ...item, category: correction.category } : item,
          ),
        }));
        next = appendCompletion(next, {
          key: `${messageId}:corrected`,
          sensitive,
          text: `Changed the draft to ${correction.category}. I’ll remember this merchant next time.`,
        });
        await rememberMerchantRule(candidate.merchant, correction.category, next);
      } else {
        const entry = (await entryStorage.load()).find(
          (item) => item.id === correction.target_id,
        );
        sensitive ||= entry?.sensitive;
        next = appendCompletion(next, {
          key: `${messageId}:corrected`,
          sensitive,
          text: `Changed to ${correction.category}. I’ll remember this merchant next time.`,
        });
        await correctSavedCategory(correction.target_id, correction.category, next);
      }
      setMessages(next);
      setEntries(await entryStorage.load());
    } catch (error) {
      setError(error.message || 'Could not apply that correction.');
    } finally {
      setActivity('');
    }
  }

  async function refundEntry(messageId, candidateId, originalId) {
    if (activity) return;
    setActivity('saving');
    try {
      const original = (await entryStorage.load()).find(
        (entry) => entry.id === originalId,
      );
      if (!original) throw new Error('The original spend no longer exists.');
      const next = appendCompletion(
        messages.map((message) =>
          message.id === messageId
            ? {
                ...message,
                candidates: message.candidates.map((candidate) =>
                  candidate.id === candidateId
                    ? { ...candidate, saved: true }
                    : candidate,
                ),
              }
            : message,
        ),
        {
          key: `${messageId}:refunded:${candidateId}`,
          text: `Marked ${entryLabel(original)} as refunded. It is excluded from spending totals.`,
          sensitive:
            original.sensitive ||
            messages.find((message) => message.id === messageId)?.sensitive,
        },
      );
      await markOriginalRefunded(originalId, next);
      setMessages(next);
      setEntries(await entryStorage.load());
    } finally {
      setActivity('');
    }
  }

  async function clearHistory() {
    await saveConversation([]);
    setMessages([]);
    setError('');
  }
  return {
    messages,
    entries,
    ready,
    error,
    activity,
    send,
    saveReview,
    cancelReview,
    ...entryActions,
    ...gmailSync,
    applyCorrection,
    refundEntry,
    clearHistory,
    cancel: () => controller.current?.abort(),
  };
}
