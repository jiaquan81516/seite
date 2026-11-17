import { openDatabase } from '../lib/storage';
import { CATEGORIES } from '../lib/config';

export const merchantKey = (merchant) =>
  merchant.trim().toLowerCase().replace(/\s+/g, ' ');

async function readStore(storeName) {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = database.transaction(storeName).objectStore(storeName).getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
export async function loadConversation() {
  const conversations = await readStore('chat');
  return conversations.find((item) => item.id === 'main')?.messages || [];
}
export const loadMerchantRules = () => readStore('merchant_rules');

export async function saveConversation(messages) {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction('chat', 'readwrite');
    transaction.objectStore('chat').put({ id: 'main', messages: messages.slice(-100) });
    transaction.oncomplete = () => resolve();
    transaction.onabort = transaction.onerror = () => reject(transaction.error);
  });
}

export async function saveReviewedEntries({
  records,
  allowDuplicateIds = [],
  rules = [],
  messages,
}) {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(
      ['records', 'merchant_rules', 'chat'],
      'readwrite',
    );
    const store = transaction.objectStore('records');
    let failure;
    const saved = [];
    store.getAll().onsuccess = (event) => {
      try {
        const existing = event.target.result;
        for (const record of records) {
          // external_ref is idempotent even when the user allows an amount/date duplicate.
          if (existing.some((item) => item.external_ref === record.external_ref))
            continue;
          const duplicate = existing.find(
            (item) =>
              item.date === record.date && item.amount_cents === record.amount_cents,
          );
          if (duplicate && !allowDuplicateIds.includes(record.id))
            throw new Error(
              `This looks like ${duplicate.merchant} ${duplicate.date}. Review the duplicate warning before adding it.`,
            );
          store.add(record);
          existing.push(record);
          saved.push(record.id);
        }
        for (const rule of rules) transaction.objectStore('merchant_rules').put(rule);
        const completedMessages =
          typeof messages === 'function' ? messages(saved) : messages;
        if (completedMessages)
          transaction
            .objectStore('chat')
            .put({ id: 'main', messages: completedMessages.slice(-100) });
      } catch (error) {
        failure = error;
        transaction.abort();
      }
    };
    transaction.oncomplete = () => resolve(saved);
    transaction.onabort = transaction.onerror = () =>
      reject(failure || transaction.error);
  });
}

export async function correctSavedCategory(id, category, messages) {
  if (!CATEGORIES.includes(category)) throw new Error('Choose a valid category.');
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(
      ['records', 'merchant_rules', ...(messages ? ['chat'] : [])],
      'readwrite',
    );
    const store = transaction.objectStore('records');
    let failure;
    store.get(id).onsuccess = (event) => {
      const entry = event.target.result;
      if (!entry) {
        failure = new Error('That entry is no longer in your tracker.');
        transaction.abort();
        return;
      }
      store.put({ ...entry, category });
      transaction
        .objectStore('merchant_rules')
        .put({ merchant: merchantKey(entry.merchant), category });
      if (messages)
        transaction
          .objectStore('chat')
          .put({ id: 'main', messages: messages.slice(-100) });
    };
    transaction.oncomplete = () => resolve();
    transaction.onabort = transaction.onerror = () =>
      reject(failure || transaction.error);
  });
}

export async function rememberMerchantRule(merchant, category, messages) {
  if (!CATEGORIES.includes(category)) throw new Error('Choose a valid category.');
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(
      ['merchant_rules', ...(messages ? ['chat'] : [])],
      'readwrite',
    );
    transaction
      .objectStore('merchant_rules')
      .put({ merchant: merchantKey(merchant), category });
    if (messages)
      transaction.objectStore('chat').put({ id: 'main', messages: messages.slice(-100) });
    transaction.oncomplete = () => resolve();
    transaction.onabort = transaction.onerror = () => reject(transaction.error);
  });
}

export async function markOriginalRefunded(id, messages) {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(['records', 'chat'], 'readwrite');
    const store = transaction.objectStore('records');
    let failure;
    store.get(id).onsuccess = (event) => {
      const entry = event.target.result;
      if (!entry) {
        failure = new Error('The original spend no longer exists.');
        transaction.abort();
        return;
      }
      store.put({ ...entry, refunded: true, refunded_at: new Date().toISOString() });
      transaction.objectStore('chat').put({ id: 'main', messages: messages.slice(-100) });
    };
    transaction.oncomplete = () => resolve();
    transaction.onabort = transaction.onerror = () =>
      reject(failure || transaction.error);
  });
}
