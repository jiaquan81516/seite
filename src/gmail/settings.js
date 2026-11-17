export const GMAIL_STORAGE_KEY = 'seite-gmail';
const URL_PATTERN =
  /^https:\/\/script\.google\.com\/(?:a\/[^/]+\/)?macros\/s\/[A-Za-z0-9_-]+\/exec$/;

export function isScriptUrl(url) {
  return URL_PATTERN.test(String(url).trim());
}

export function validateGmailSettings({ url, key }) {
  const cleanUrl = String(url || '').trim();
  const cleanKey = String(key || '').trim();
  if (!isScriptUrl(cleanUrl))
    throw new Error(
      'Paste the Web app URL from your script’s deployment. It starts with https://script.google.com/ and ends with /exec.',
    );
  if (cleanKey.length < 20)
    throw new Error(
      'The sync key should be at least 20 characters, the same as in your script.',
    );
  return { url: cleanUrl, key: cleanKey };
}

export function loadGmailSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(GMAIL_STORAGE_KEY) || 'null');
    return saved ? validateGmailSettings(saved) : null;
  } catch {
    return null;
  }
}

export function saveGmailSettings(settings) {
  const clean = validateGmailSettings(settings);
  localStorage.setItem(GMAIL_STORAGE_KEY, JSON.stringify(clean));
  return clean;
}

export function clearGmailSettings() {
  localStorage.removeItem(GMAIL_STORAGE_KEY);
}
