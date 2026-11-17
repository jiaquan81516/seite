import { CATEGORIES } from '../lib/config';
import { formatDate, isValidDate, shiftDays, today as todayDate } from '../lib/dates';
import { formatMoney, totalAmount } from '../lib/money';
import { sortEntries } from '../lib/transactions';
import { entryLabel } from './completion-messages';

// Match complete, simple questions only. Ambiguous requests and receipt instructions
// still go through AI rather than silently answering a different question.
export function spendingFactId(text) {
  const question = text
    .toLowerCase()
    .trim()
    .replace(/[?!.]+$/, '')
    .trim();
  const match = question.match(
    /^(?:how much(?: (?:did|have) i| did)?(?: (?:spend|spent))?|what(?:'s| is) my (?:total )?(?:spending|spend|expenses)|(?:show|tell) me my (?:total )?(?:spending|expenses))(?: on ([a-z &-]+?))? (today|this week|this month)$/,
  );
  if (!match) return null;
  const period = { today: 'Day', 'this week': 'Week', 'this month': 'Month' }[match[2]];
  if (!match[1]) return `${period}:total`;
  const categoryName = match[1] === 'food' ? 'food & drink' : match[1];
  const category = CATEGORIES.find((item) => item.toLowerCase() === categoryName);
  return category ? `${period}:category:${category}` : null;
}

const MONTHS = [
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
];
const ORDINALS = Object.fromEntries(
  [
    'first',
    'second',
    'third',
    'fourth',
    'fifth',
    'sixth',
    'seventh',
    'eighth',
    'ninth',
    'tenth',
    'eleventh',
    'twelfth',
    'thirteenth',
    'fourteenth',
    'fifteenth',
    'sixteenth',
    'seventeenth',
    'eighteenth',
    'nineteenth',
    'twentieth',
    'twenty-first',
    'twenty-second',
    'twenty-third',
    'twenty-fourth',
    'twenty-fifth',
    'twenty-sixth',
    'twenty-seventh',
    'twenty-eighth',
    'twenty-ninth',
    'thirtieth',
    'thirty-first',
  ].map((word, index) => [word, index + 1]),
);
const DAY = '(\\d{1,2})(?:st|nd|rd|th)?|(' + Object.keys(ORDINALS).join('|') + ')';
const MONTH =
  '(' + MONTHS.map((name) => `${name}|${name.slice(0, 3)}`).join('|') + '|sept)';
const DAY_FIRST = new RegExp(`^(?:the )?(?:${DAY})(?: of)? ${MONTH}(?:,? (\\d{4}))?$`);
const MONTH_FIRST = new RegExp(`^${MONTH} (?:${DAY})(?:,? (\\d{4}))?$`);
const LEAD =
  '(?:(?:please )?(?:show|tell|give) me|show|what (?:did i spend|were my|are my)|how much (?:did i spend|have i spent|i spent)|my|list)';
const TAIL = '(?:spendings?|spending|spends?|expenses?|entries|transactions?)';

function monthIndex(name) {
  const index = MONTHS.findIndex((month) => month === name || month.slice(0, 3) === name);
  return name === 'sept' ? 8 : index;
}
function pad(value) {
  return String(value).padStart(2, '0');
}

// Resolve a simple "which day?" spending question to one YYYY-MM-DD date. A date
// without a year means its most recent occurrence, never a future date.
export function spendingQuestionDate(text, today) {
  const question = text
    .toLowerCase()
    .trim()
    .replace(/[?!.]+$/, '')
    .replace(/\s+/g, ' ');
  if (/\b(add|save|log|delete|remove|compare|versus|vs|and|total|than)\b/.test(question))
    return null;
  const lead = new RegExp(`^(${LEAD}) (?:on |for |from )?`).exec(question);
  const rest = lead ? question.slice(lead[0].length) : question;
  const tail = new RegExp(`^(.*?)(?: ${TAIL})$`).exec(rest);
  // Require a lookup cue so a bare "2 nov" is not guessed as a spending question.
  if (!lead && !tail) return null;
  const expression = (tail ? tail[1] : rest).replace(/^(?:on |for )/, '');
  if (expression === 'yesterday') return shiftBack(today);
  let day, month, year;
  let match = DAY_FIRST.exec(expression);
  if (match) {
    day = match[1] || ORDINALS[match[2]];
    month = match[3];
    year = match[4];
  } else if ((match = MONTH_FIRST.exec(expression))) {
    month = match[1];
    day = match[2] || ORDINALS[match[3]];
    year = match[4];
  } else return null;
  const monthNumber = monthIndex(month) + 1;
  const build = (value) => `${value}-${pad(monthNumber)}-${pad(day)}`;
  let date = build(year || today.slice(0, 4));
  if (!year && date > today) date = build(Number(today.slice(0, 4)) - 1);
  return isValidDate(date) ? date : null;
}
function shiftBack(today) {
  return shiftDays(today, -1);
}

export function dateSpendingFact(text, entries, today = todayDate()) {
  const date = spendingQuestionDate(text, today);
  if (!date) return null;
  const matching = sortEntries(entries.filter((entry) => entry.date === date));
  const spent = matching.filter((entry) => !entry.refunded);
  const label = formatDate(date);
  const view = { date, period: 'Day', category: '', method: '', search: '', day: '' };
  if (!matching.length) return { text: `There are no saved spends on ${label}.`, view };
  const listed = matching
    .slice(0, 5)
    .map((entry) => entryLabel(entry))
    .join(', ');
  const more = matching.length > 5 ? `, and ${matching.length - 5} more` : '';
  return {
    text: `You spent ${formatMoney(totalAmount(spent))} on ${label} across ${spent.length} ${spent.length === 1 ? 'entry' : 'entries'}: ${listed}${more}.`,
    view,
  };
}

// "daily average this month", "average spending per day", "avg last week".
// Anything about a category, comparison or change is left to the AI.
export function averageFactId(text) {
  const question = text
    .toLowerCase()
    .trim()
    .replace(/[?!.]+$/, '')
    .replace(/\s+/g, ' ');
  if (!/\b(average|avg)\b/.test(question)) return null;
  if (
    /\b(add|save|log|delete|remove|compare|versus|vs|than|on|for|per (?:entry|merchant|category|transaction))\b/.test(
      question.replace(/ per day/g, '').replace(/for (?:the )?(?:this|last)/g, ''),
    )
  )
    return null;
  if (!/\b(daily|per day|a day|each day|every day|day)\b/.test(question)) return null;
  const week = /\bweek\b/.test(question);
  const last = /\blast\b/.test(question);
  const period = week ? 'Week' : 'Month';
  return last ? `prev:${period}:average` : `${period}:average`;
}
