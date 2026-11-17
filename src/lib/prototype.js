export const PROTOTYPE_KEY = 'seite-prototype';
export const PROTOTYPES = ['A', 'B'];

// Prototype A is the original tracker layout. Prototype B groups entries by day.
export function getPrototype() {
  try {
    return localStorage.getItem(PROTOTYPE_KEY) === 'B' ? 'B' : 'A';
  } catch {
    return 'A';
  }
}
export function setPrototype(value) {
  const next = value === 'B' ? 'B' : 'A';
  try {
    localStorage.setItem(PROTOTYPE_KEY, next);
  } catch {
    /* The choice still applies until the page is reloaded. */
  }
  return next;
}
