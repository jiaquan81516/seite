import mockFinance from '../data/mock-finance.json';
import mockNovember from '../data/mock-november.json';
import { billStorage, goalStorage, incomeStorage } from './finance-storage';
import { PLAN_KEY, loadPlan, savePlan } from './finance';
import { parseBackup } from './backups';
import { entryStorage } from './storage';

// Built-in sample spending for November 2026 so every signed-in account has
// something to explore. Set VITE_DEMO_DATA=off to build without it.
export const DEMO_DATA_ENABLED =
  import.meta.env.MODE !== 'test' && import.meta.env.VITE_DEMO_DATA !== 'off';
export const AUTO_SEED_KEY = 'seite-demo-auto-seed';
export const SAMPLE_PREFIX = 'mock-nov-';

// People can switch the automatic sample data off from the Demo tab.
export function isAutoSeedOn() {
  try {
    return localStorage.getItem(AUTO_SEED_KEY) !== 'off';
  } catch {
    return true;
  }
}
export function setAutoSeed(on) {
  try {
    if (on) localStorage.removeItem(AUTO_SEED_KEY);
    else localStorage.setItem(AUTO_SEED_KEY, 'off');
  } catch {
    /* Keep the default when storage is unavailable. */
  }
}
export const isSampleEntry = (entry) => String(entry.id).startsWith(SAMPLE_PREFIX);
export async function countSampleEntries() {
  return (await entryStorage.load()).filter(isSampleEntry).length;
}
// Removes only the built-in sample entries, never anything the person added.
export async function removeSampleEntries() {
  const ids = (await entryStorage.load()).filter(isSampleEntry).map((entry) => entry.id);
  if (ids.length) await entryStorage.removeMany(ids);
  for (const { storage, items } of SAMPLE_FINANCE) {
    const sample = new Set(items.map((item) => item.id));
    const stale = (await storage.load()).filter((item) => sample.has(item.id));
    if (stale.length) await storage.removeMany(stale.map((item) => item.id));
  }
  const limits = loadPlan();
  if (JSON.stringify(limits) === JSON.stringify(mockFinance.limits))
    localStorage.removeItem(PLAN_KEY);
  return ids.length;
}
export const DEMO_ENTRIES = parseBackup(JSON.stringify(mockNovember));

export const SAMPLE_FINANCE = [
  { storage: incomeStorage, items: mockFinance.income },
  { storage: billStorage, items: mockFinance.bills },
  { storage: goalStorage, items: mockFinance.goals },
];

// Adds the sample income, bills and goals that are not saved yet, and the sample
// spending limits only when the person has not set any of their own.
export async function seedFinanceData() {
  let added = 0;
  for (const { storage, items } of SAMPLE_FINANCE) {
    const saved = new Set((await storage.load()).map((item) => item.id));
    const missing = items.filter((item) => !saved.has(item.id));
    if (missing.length) await storage.saveMany(missing);
    added += missing.length;
  }
  const limits = loadPlan();
  if (
    Object.values(limits).every((value) => value === null) &&
    !localStorage.getItem(PLAN_KEY)
  )
    savePlan(mockFinance.limits);
  return added;
}

// Adds any sample entries that are not saved yet. Never touches other entries.
export async function seedDemoData() {
  const saved = new Set((await entryStorage.load()).map((record) => record.id));
  const missing = DEMO_ENTRIES.filter((record) => !saved.has(record.id));
  const added = missing.length ? (await entryStorage.importBackup(missing)).added : 0;
  await seedFinanceData();
  return added;
}
