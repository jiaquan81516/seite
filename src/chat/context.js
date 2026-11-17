import { redactSensitiveText } from '../../shared/privacy';
export { redactSensitiveText } from '../../shared/privacy';
import { CATEGORIES, PAYMENT_METHODS } from '../lib/config';
import { daysInPeriod, formatDate, movePeriod, periodRange, today } from '../lib/dates';
import { formatMoney, totalAmount } from '../lib/money';

export function buildChatContext(entries, messages, date = today()) {
  const facts = [];
  for (const period of ['Day', 'Week', 'Month']) {
    const [start, end] = periodRange(date, period);
    const current = entries.filter(
      (entry) => !entry.refunded && entry.date >= start && entry.date <= end,
    );
    const periodWords =
      period === 'Day' ? 'today' : period === 'Week' ? 'this week' : 'this month';
    const view = { date, period, category: '', method: '', search: '', day: '' };
    facts.push({
      id: `${period}:total`,
      text: `You spent ${formatMoney(totalAmount(current))} ${periodWords} across ${current.length} entries.`,
      view,
    });
    for (const category of CATEGORIES) {
      const matching = current.filter((entry) => entry.category === category);
      facts.push({
        id: `${period}:category:${category}`,
        text: `You spent ${formatMoney(totalAmount(matching))} on ${category.toLowerCase()} ${periodWords}.`,
        view: { ...view, category },
      });
    }
    for (const method of PAYMENT_METHODS) {
      const matching = current.filter((entry) => entry.method === method);
      facts.push({
        id: `${period}:method:${method}`,
        text: `You spent ${formatMoney(totalAmount(matching))} using ${method} ${periodWords}.`,
        view: { ...view, method },
      });
    }
    const biggest = [...current].sort((a, b) => b.amount_cents - a.amount_cents)[0];
    facts.push({
      id: `${period}:biggest`,
      text: biggest
        ? `Your biggest spend ${periodWords} was ${formatMoney(biggest.amount_cents)} at ${redactSensitiveText(biggest.merchant)} on ${formatDate(biggest.date)}.`
        : `There are no saved spends ${periodWords}.`,
      view: biggest ? { ...view, search: biggest.merchant } : view,
    });
  }
  // Earlier periods and merchants. Calculated here so the AI only picks a fact.
  for (const [period, words, id] of [
    ['Day', 'yesterday', 'prev:Day:total'],
    ['Week', 'last week', 'prev:Week:total'],
    ['Month', 'last month', 'prev:Month:total'],
  ]) {
    const earlier = movePeriod(date, period, -1);
    const [start, end] = periodRange(earlier, period);
    const current = entries.filter(
      (entry) => !entry.refunded && entry.date >= start && entry.date <= end,
    );
    facts.push({
      id,
      text: `You spent ${formatMoney(totalAmount(current))} ${words} across ${current.length} entries.`,
      view: { date: earlier, period, category: '', method: '', search: '', day: '' },
    });
  }
  // Daily averages divide by the days that have actually passed in the current
  // period, and by every day of a finished one, so they are never inflated.
  for (const [period, earlier, id, words] of [
    ['Week', false, 'Week:average', 'this week'],
    ['Month', false, 'Month:average', 'this month'],
    ['Week', true, 'prev:Week:average', 'last week'],
    ['Month', true, 'prev:Month:average', 'last month'],
  ]) {
    const anchor = earlier ? movePeriod(date, period, -1) : date;
    const [start, end] = periodRange(anchor, period);
    const days = daysInPeriod(anchor, period).filter((day) => earlier || day <= date);
    const spent = entries.filter(
      (entry) => !entry.refunded && entry.date >= start && entry.date <= end,
    );
    const total = totalAmount(spent);
    facts.push({
      id,
      text: `Your daily average ${words} is ${formatMoney(Math.round(total / days.length))} (${formatMoney(total)} over ${days.length} ${days.length === 1 ? 'day' : 'days'}${earlier ? '' : ' so far'}).`,
      view: { date: anchor, period, category: '', method: '', search: '', day: '' },
    });
  }
  const [monthStart, monthEnd] = periodRange(date, 'Month');
  const spentThisMonth = entries.filter(
    (entry) => !entry.refunded && entry.date >= monthStart && entry.date <= monthEnd,
  );
  const byMerchant = new Map();
  for (const entry of spentThisMonth)
    byMerchant.set(
      entry.merchant,
      (byMerchant.get(entry.merchant) || 0) + entry.amount_cents,
    );
  const topMerchants = [...byMerchant].sort((a, b) => b[1] - a[1]).slice(0, 3);
  facts.push({
    id: 'Month:merchants',
    text: topMerchants.length
      ? `Your top merchants this month: ${topMerchants
          .map(
            ([merchant, cents]) =>
              `${redactSensitiveText(merchant)} (${formatMoney(cents)})`,
          )
          .join(', ')}.`
      : 'There are no saved spends this month.',
    view: { date, period: 'Month', category: '', method: '', search: '', day: '' },
  });
  const lastProposals =
    [...messages].reverse().find((message) => message.candidates?.length)?.candidates ||
    [];
  return {
    facts,
    request: {
      today: date,
      facts: facts.map(({ id, text }) => ({ id, text })),
      recent: [...entries]
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .slice(0, 12)
        .map((entry) => ({
          id: entry.id,
          merchant: redactSensitiveText(entry.merchant),
          date: entry.date,
          amount_cents: entry.amount_cents,
          category: entry.category,
        })),
      candidates: lastProposals
        .filter((candidate) => !candidate.saved)
        .slice(0, 30)
        .map((candidate) => ({
          id: `draft:${candidate.id}`,
          merchant: candidate.merchant && redactSensitiveText(candidate.merchant),
          category: candidate.category,
          amount: candidate.amount,
          currency: candidate.currency,
          date: candidate.date,
        })),
    },
  };
}
