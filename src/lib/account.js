import { PAYMENT_METHODS } from './config';

export const ACCOUNT_STORAGE_KEY = 'seite-account';
export const PREVIEW_SESSION_KEY = 'seite-preview-session';
export const AVATAR_COLORS = ['Peach', 'Sage', 'Sky', 'Lavender'];
export const DEFAULT_ACCOUNT = {
  profile: { name: '', email: '', color: 'Peach' },
  preferences: { defaultPeriod: 'Day', defaultMethod: '', reduceMotion: false },
};

export function normalizeAccount(value) {
  const profile = value?.profile ?? {};
  const preferences = value?.preferences ?? {};
  return {
    profile: {
      name: typeof profile.name === 'string' ? profile.name.slice(0, 80) : '',
      email: typeof profile.email === 'string' ? profile.email.slice(0, 254) : '',
      color: AVATAR_COLORS.includes(profile.color) ? profile.color : 'Peach',
    },
    preferences: {
      defaultPeriod: ['Day', 'Week', 'Month'].includes(preferences.defaultPeriod)
        ? preferences.defaultPeriod
        : 'Day',
      defaultMethod: PAYMENT_METHODS.includes(preferences.defaultMethod)
        ? preferences.defaultMethod
        : '',
      reduceMotion: preferences.reduceMotion === true,
    },
  };
}

export function readAccount() {
  try {
    const saved = localStorage.getItem(ACCOUNT_STORAGE_KEY);
    return {
      account: saved ? normalizeAccount(JSON.parse(saved)) : DEFAULT_ACCOUNT,
      error: '',
    };
  } catch {
    return {
      account: DEFAULT_ACCOUNT,
      error: 'Your saved profile or settings could not be read. Defaults are being used.',
    };
  }
}

export function profileInitials(name) {
  return (
    name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => Array.from(word)[0])
      .join('')
      .toUpperCase() || 'S'
  );
}
