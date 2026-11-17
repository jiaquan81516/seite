export const CATEGORIES = [
  'Food & Drink',
  'Groceries',
  'Transport',
  'Shopping',
  'Bills & Utilities',
  'Health',
  'Entertainment',
  'Education',
  'Transfers & Top-ups',
  'Other',
];
export const PAYMENT_METHODS = [
  'Apple Pay',
  'PayLah',
  'SC Card',
  'YouTrip',
  'ShopeePay',
  'Card',
  'Cash',
  'Other',
];
const CATEGORY_COLORS = [
  '#ff8a39',
  '#58b68b',
  '#529cff',
  '#ad86d9',
  '#d5aa56',
  '#46aaa8',
  '#ec80a1',
  '#7e94cd',
  '#bb9879',
  '#a5adba',
];
export function categoryColor(category) {
  return CATEGORY_COLORS[CATEGORIES.indexOf(category)] ?? '#a5adba';
}
