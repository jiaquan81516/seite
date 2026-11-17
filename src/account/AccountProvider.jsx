import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { GMAIL_STORAGE_KEY } from '../gmail/settings';
import { disableDemo } from '../gmail/demo';
import { AUTO_SEED_KEY } from '../lib/demo-data';
import { PLAN_KEY } from '../lib/finance';
import { PROTOTYPE_KEY } from '../lib/prototype';
import {
  ACCOUNT_STORAGE_KEY,
  DEFAULT_ACCOUNT,
  PREVIEW_SESSION_KEY,
  normalizeAccount,
  readAccount,
} from '../lib/account';

const AccountContext = createContext(null);

export function AccountProvider({ children }) {
  const [initial] = useState(readAccount);
  const [account, setAccount] = useState(initial.account);
  const [readError, setReadError] = useState(initial.error);
  const [sessionActive, setSessionActive] = useState(() => {
    try {
      return sessionStorage.getItem(PREVIEW_SESSION_KEY) === 'active';
    } catch {
      return false;
    }
  });
  useEffect(() => {
    document.documentElement.dataset.reduceMotion = String(
      account.preferences.reduceMotion,
    );
    return () => {
      delete document.documentElement.dataset.reduceMotion;
    };
  }, [account.preferences.reduceMotion]);

  function saveAccount(changes) {
    const next = normalizeAccount({ ...account, ...changes });
    try {
      localStorage.setItem(ACCOUNT_STORAGE_KEY, JSON.stringify(next));
    } catch {
      throw new Error(
        'Changes could not be saved. Check browser storage permissions and try again.',
      );
    }
    setAccount(next);
    setReadError('');
  }
  const beginPreview = useCallback(() => {
    try {
      sessionStorage.setItem(PREVIEW_SESSION_KEY, 'active');
    } catch {
      /* In-memory preview still works. */
    }
    setSessionActive(true);
  }, []);
  const endPreview = useCallback(() => {
    try {
      sessionStorage.removeItem(PREVIEW_SESSION_KEY);
    } catch {
      /* Always end the in-memory session. */
    }
    setSessionActive(false);
  }, []);
  function resetAccount() {
    // Remove only Seite's keys; never clear unrelated browser storage.
    localStorage.removeItem(ACCOUNT_STORAGE_KEY);
    localStorage.removeItem('seite-data');
    localStorage.removeItem('seite-ai-consent');
    localStorage.removeItem(GMAIL_STORAGE_KEY);
    localStorage.removeItem(PROTOTYPE_KEY);
    localStorage.removeItem(AUTO_SEED_KEY);
    localStorage.removeItem(PLAN_KEY);
    disableDemo();
    setAccount(DEFAULT_ACCOUNT);
    setReadError('');
    endPreview();
  }
  return (
    <AccountContext.Provider
      value={{
        ...account,
        sessionActive,
        readError,
        saveAccount,
        resetAccount,
        beginPreview,
        endPreview,
      }}
    >
      {children}
    </AccountContext.Provider>
  );
}

export function useAccount() {
  const account = useContext(AccountContext);
  if (!account) throw new Error('Account controls require an AccountProvider.');
  return account;
}
