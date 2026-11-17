import { CATEGORIES, PAYMENT_METHODS } from '../src/lib/config.js';

// The single description of Seite that both the Help Center screen and the AI
// assistant read. Edit it here and the screen and the assistant stay in step.
export const HELP_QUESTIONS = [
  {
    title: 'How do I add or change a spend?',
    text: 'Use Add a spend in the fixed bottom bar. Enter the merchant, amount, transaction date, category and payment method, then save. Tap any saved entry to edit it or delete it with confirmation.',
  },
  {
    title: 'How do filters and charts work?',
    text: 'Choose Day, Week or Month, then use search, category or payment method to narrow the list. Tap a category slice or day bar to filter. Tap it again, or use Clear filters, to reset. Weeks run Monday through Sunday.',
  },
  {
    title: 'Do I need an account? What does sign out do?',
    text: 'No account is required. The sign-in and sign-up screens are a visual preview, and their credentials are never saved or sent. Sign out ends the local preview session and returns you to sign-in; it keeps your saved entries and profile. This isn’t a password lock for your device.',
  },
  {
    title: 'Where is my spending saved?',
    text: 'Entries are saved in this browser on this device. There is no cloud sync or backup yet. Clearing site data, storage eviction or private browsing can remove them. Download a JSON backup from Your data to keep a copy.',
  },
  {
    title: 'How do I move my entries to another device?',
    text: 'Go to Your data, choose Download JSON backup, and save the file. On the other device, open Seite → Your data, choose that file and review the restore. Matching entry IDs are skipped; conflicts are reported before anything is imported. CSV is for spreadsheets, not restoration.',
  },
  {
    title: 'How do I install Seite and use it offline?',
    text: 'On iPhone, open the HTTPS app in Safari, then Share → Add to Home Screen. On Android or desktop, use Install app from the browser. Load the production app online first and reload once before going offline. Development mode does not enable the service worker.',
  },
  {
    title: 'Can I connect Gmail or use the AI bot now?',
    text: 'AI chat can read screenshots and selected PDF pages after a server-only Gemini key is configured. Choose a photo or PDF page, press Send, then review the extracted spends before saving. Enter sends a message; Shift+Enter adds a new line. Cancel dismisses an unsaved review. Gmail is connected from the Gmail page in the account menu by setting up a small script in your own Google account; sign-in never connects your inbox automatically.',
  },
  {
    title: 'Why can’t I save a change?',
    text: 'Your browser may have blocked storage or run out of space. Check site storage permissions, then retry. Export a backup before clearing any browser data. Seite shows an error instead of claiming a failed write was saved.',
  },
  {
    title: 'How do I reduce animations?',
    text: 'Open Preferences and turn on Reduce motion. Seite also respects your device’s reduced-motion setting. Your choice is saved on this browser.',
  },
  {
    title: 'How do I delete my data?',
    text: 'Open Your data and choose Delete all local data. Download an entries backup if you want to keep your history, then type DELETE to confirm. Entries, profile and preferences on this browser are removed. Your downloaded backups and other devices are unaffected.',
  },
];

export const APP_PAGES = [
  {
    name: 'Home',
    route: '#/home',
    text: 'Landing page that explains the idea and the planned email-to-tracker flow.',
  },
  {
    name: 'Sign in / Sign up',
    route: '#/signin, #/signup',
    text: 'Visual preview only. Nothing is sent or saved and there is no real account.',
  },
  {
    name: 'Tracker',
    route: '#/tracker',
    text: 'The manual tracker: Day, Week and Month views, filters, category donut, day bars, entry list and an Add a spend bar. Works without an account.',
  },
  {
    name: 'Income',
    route: '#/tracker (Expenses | Income switch)',
    text: 'Money in for the chosen period, kept apart from spending: balance (in minus out), where it came from, and add, edit or delete income.',
  },
  {
    name: 'Bills',
    route: '#/bills',
    text: 'Upcoming bills by month with Paid, Due soon and Overdue labels. Bills are ticked paid when a saved spend has the same merchant words and exact amount, or by hand. Add, edit or delete bills.',
  },
  {
    name: 'Plan',
    route: '#/plan',
    text: 'Spending limits for today, this week and this month with how much is left, plus savings goals with progress bars.',
  },
  {
    name: 'Chat',
    route: '#/chat',
    text: 'This assistant: reads receipt screenshots and PDF pages, answers spending questions, helps with using the app, and previews removals and edits.',
  },
  {
    name: 'Account menu (avatar)',
    route: '#/profile, #/settings, #/data, #/gmail, #/demo, #/help, #/privacy',
    text: 'My profile, Preferences, Your data (export, restore, delete), Gmail, Demo (sample November data, simulated Gmail emails and a Prototype A/B switch for the tracker layout), Help & getting started, Privacy & about, Sign out.',
  },
];

export const CHAT_CAPABILITIES = [
  'Read a receipt, payment screenshot or selected PDF pages and propose spends. Every proposal is reviewed and confirmed in the app before anything is saved.',
  'Answer simple spending questions for today, this week or this month, last week and last month, daily averages (for example "daily average this month"), top merchants this month, and a named day such as "2 nov spendings". Totals and averages are calculated by the app, never by the AI.',
  'Remove or edit one saved entry. The app shows the entry first and nothing changes until the user confirms. Undo is available afterwards.',
  'Remove several entries at once, for example "delete all my transport spending in October". The app lists every match, the user can untick entries, removing 10 or more requires typing the count, and Undo or a backup download is available afterwards. Deleting everything is not done in chat; use Your data → Delete all local data.',
  'Restore entries that were just removed in this chat: say "add back the deleted data" and confirm. This works offline and restores the most recent removal. Older entries need a downloaded JSON backup (Your data).',
  'Collect bank, wallet and receipt emails from Gmail once the Gmail script is connected. Clear SGD transactions are saved automatically; unclear, foreign-currency or possible duplicate ones are shown for review. Refunds, income and transfers are not logged. A demo mode (account menu → Gmail → Try the demo) shows the same flow with simulated emails and no setup. The chat checks when opened, every 10 minutes while open, and on Check now.',
  'Change an entry category and remember the merchant for next time.',
  'Explain how any part of the app works, from the guide below.',
];

export const NOT_AVAILABLE = [
  'Direct bank connections, and Gmail logging without first setting up the Gmail script (account menu → Gmail)',
  'Income, Bills, Plan (budgets and savings goals) and Summary sections',
  'Cloud sync or cloud backup; entries live only in this browser on this device',
  'Real sign-in, passwords or password reset',
  'Push notifications',
  'Currencies other than SGD for saved totals (foreign receipts are converted for review)',
];

// Plain text for the model. Keep it factual and compact: the model is told to
// answer how-to questions only from this text.
export function buildAppGuide() {
  return [
    'SEITE APP GUIDE (the only source for questions about the app):',
    'Seite is a personal daily spending tracker and offline-capable web app (PWA) for one user, in SGD with Singapore dates.',
    'PAGES:',
    ...APP_PAGES.map((page) => `- ${page.name} (${page.route}): ${page.text}`),
    'WHAT THE CHAT CAN DO:',
    ...CHAT_CAPABILITIES.map((item) => `- ${item}`),
    'HELP TOPICS:',
    ...HELP_QUESTIONS.map((item) => `- ${item.title} ${item.text}`),
    `CATEGORIES: ${CATEGORIES.join(', ')}.`,
    `PAYMENT METHODS: ${PAYMENT_METHODS.join(', ')}.`,
    'NOT AVAILABLE YET:',
    ...NOT_AVAILABLE.map((item) => `- ${item}`),
  ].join('\n');
}
