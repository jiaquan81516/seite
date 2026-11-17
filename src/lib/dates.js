function toDate(date) {
  return new Date(`${date}T12:00:00Z`);
}
function toDateString(date) {
  return date.toISOString().slice(0, 10);
}
export function today() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Singapore',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}
export function normalizeTime(value) {
  const text = String(value ?? '')
    .trim()
    .toLowerCase();
  if (!text) return '';
  const match = /^(\d{1,2})[:.](\d{2})(?:[:.]\d{2}(?:\.\d+)?)?\s*(am|pm)?$/.exec(text);
  if (!match) return '';
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const period = match[3];
  if (minute > 59) return '';
  if (period) {
    if (hour < 1 || hour > 12) return '';
    hour = (hour % 12) + (period === 'pm' ? 12 : 0);
  } else if (hour > 23) return '';
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}
export function nowTime() {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Singapore',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
    .format(new Date())
    .replace('24:', '00:');
}
export function isValidDate(date) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    !Number.isNaN(toDate(date).getTime()) &&
    toDateString(toDate(date)) === date
  );
}
export function shiftDays(date, days) {
  const result = toDate(date);
  result.setUTCDate(result.getUTCDate() + days);
  return toDateString(result);
}
export function periodRange(date, period) {
  if (period === 'Day') return [date, date];
  if (period === 'Month') {
    const start = `${date.slice(0, 7)}-01`;
    const end = toDate(start);
    end.setUTCMonth(end.getUTCMonth() + 1, 0);
    return [start, toDateString(end)];
  }
  const monday = shiftDays(date, -((toDate(date).getUTCDay() + 6) % 7));
  return [monday, shiftDays(monday, 6)];
}
export function movePeriod(date, period, direction) {
  if (period !== 'Month') return shiftDays(date, direction * (period === 'Week' ? 7 : 1));
  const result = toDate(`${date.slice(0, 7)}-01`);
  result.setUTCMonth(result.getUTCMonth() + direction);
  return toDateString(result);
}
export function formatDate(
  date,
  options = { day: 'numeric', month: 'short', year: 'numeric' },
) {
  return toDate(date).toLocaleDateString('en-SG', { ...options, timeZone: 'UTC' });
}
export function periodLabel(date, period) {
  const [start, end] = periodRange(date, period);
  if (period === 'Month') return formatDate(start, { month: 'long', year: 'numeric' });
  if (start === end)
    return formatDate(start, { weekday: 'long', day: 'numeric', month: 'long' });
  return `${formatDate(start)} – ${formatDate(end)}`;
}
export function daysInPeriod(date, period) {
  const [start, end] = periodRange(date, period);
  const days = [];
  for (let day = start; day <= end; day = shiftDays(day, 1)) days.push(day);
  return days;
}
