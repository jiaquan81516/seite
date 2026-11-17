import { AccountProvider } from '../src/account/AccountProvider';
import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BillsPage from '../src/pages/BillsPage';
import PlanPage from '../src/pages/PlanPage';
import { IncomeView } from '../src/components/IncomeView';
import { LimitStrip } from '../src/components/LimitStrip';
import { billStorage, goalStorage, incomeStorage } from '../src/lib/finance-storage';
import { loadPlan, savePlan } from '../src/lib/finance';
import { today } from '../src/lib/dates';
import { removeSampleEntries, seedDemoData } from '../src/lib/demo-data';
import { entryStorage } from '../src/lib/storage';
import { makeEntry } from './fixtures';

const bill = (overrides) => ({
  id: 'b1',
  name: 'Singtel Mobile',
  amount_cents: 3900,
  due_date: `${today().slice(0, 7)}-03`,
  kind: 'recurring',
  keywords: ['singtel'],
  paid: false,
  created_at: '2026-10-01T00:00:00Z',
  ...overrides,
});
const wrap = (node) => <AccountProvider>{node}</AccountProvider>;

beforeEach(async () => {
  localStorage.clear();
  await entryStorage.clear();
});

describe('Bills page', () => {
  it('ticks a bill paid from a matching spend and lists it as Paid', async () => {
    await billStorage.save(bill());
    await entryStorage.save(
      makeEntry({
        id: 's',
        merchant: 'Singtel Mobile',
        amount_cents: 3900,
        date: `${today().slice(0, 7)}-03`,
      }),
    );
    render(wrap(<BillsPage navigate={() => {}} onSignOut={() => {}} />));
    await screen.findByLabelText('Singtel Mobile paid');
    await waitFor(() =>
      expect(screen.getByLabelText('Singtel Mobile paid')).toBeChecked(),
    );
    expect(screen.getByText('Paid')).toBeInTheDocument();
    await waitFor(async () => expect((await billStorage.load())[0].paid).toBe(true));
  });
  it('shows overdue, due soon and TBC amounts, and totals what is left', async () => {
    const month = today().slice(0, 7);
    await billStorage.saveMany([
      bill({
        id: 'o',
        name: 'Library fine',
        amount_cents: 420,
        due_date: `${month}-01`,
        keywords: ['library'],
      }),
      bill({
        id: 't',
        name: 'SP Services',
        amount_cents: null,
        due_date: `${month}-28`,
        keywords: ['sp'],
      }),
    ]);
    render(wrap(<BillsPage navigate={() => {}} onSignOut={() => {}} />));
    expect(await screen.findByText('Amount TBC')).toBeInTheDocument();
    expect(screen.getByText(/Overdue by/)).toBeInTheDocument();
    expect(
      screen.getByText(/S\$4\.20 still to pay, plus 1 amount to be confirmed/),
    ).toBeInTheDocument();
  });
  it('creates next month’s bill when a recurring bill is ticked, and untick keeps it unpaid', async () => {
    const user = userEvent.setup();
    await billStorage.save(bill({ name: 'Netflix', keywords: ['nflx'] }));
    render(wrap(<BillsPage navigate={() => {}} onSignOut={() => {}} />));
    await user.click(await screen.findByLabelText('Netflix paid'));
    await waitFor(async () => expect(await billStorage.load()).toHaveLength(2));
    const saved = await billStorage.load();
    expect(saved.find((item) => item.id === 'b1')).toMatchObject({
      paid: true,
      manual: true,
    });
    await user.click(screen.getByLabelText('Netflix paid'));
    await waitFor(async () =>
      expect((await billStorage.load()).find((item) => item.id === 'b1').paid).toBe(
        false,
      ),
    );
  });
  it('adds a bill from the form', async () => {
    const user = userEvent.setup();
    render(wrap(<BillsPage navigate={() => {}} onSignOut={() => {}} />));
    await screen.findByText('No bills this month');
    await user.click(screen.getAllByRole('button', { name: /Add a bill/ })[0]);
    const dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByLabelText('Name'), 'Gym');
    await user.type(within(dialog).getByLabelText(/Amount/), '59');
    await user.click(within(dialog).getByRole('button', { name: 'Save bill' }));
    expect(await screen.findByLabelText('Gym paid')).toBeInTheDocument();
    expect((await billStorage.load())[0]).toMatchObject({
      name: 'Gym',
      amount_cents: 5900,
    });
  });
});

describe('Plan page', () => {
  it('sets a weekly limit and shows what is left', async () => {
    const user = userEvent.setup();
    await entryStorage.save(makeEntry({ id: 'e', date: today(), amount_cents: 2500 }));
    render(wrap(<PlanPage navigate={() => {}} onSignOut={() => {}} />));
    const input = await screen.findByLabelText('This week limit (SGD)');
    await user.type(input, '100');
    await user.click(within(input.closest('form')).getByRole('button', { name: 'Set' }));
    expect(loadPlan().Week).toBe(10000);
    expect(await screen.findByText('S$75.00 left')).toBeInTheDocument();
    expect(
      screen.getByRole('progressbar', { name: 'This week spending' }),
    ).toHaveAttribute('aria-valuenow', '25');
  });
  it('adds a goal, adds savings to it and deletes it', async () => {
    const user = userEvent.setup();
    render(wrap(<PlanPage navigate={() => {}} onSignOut={() => {}} />));
    await screen.findByText('No goals yet');
    await user.click(screen.getByRole('button', { name: '+ Add a goal' }));
    const dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByLabelText('Goal'), 'Trip');
    await user.type(within(dialog).getByLabelText(/Target amount/), '1000');
    await user.click(within(dialog).getByRole('button', { name: 'Save goal' }));
    await user.type(await screen.findByLabelText('Add to Trip (SGD)'), '250');
    await user.click(screen.getByRole('button', { name: 'Add', exact: true }));
    expect(await screen.findByText('S$250.00 of S$1,000.00')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Delete Trip' }));
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete spend' }),
    );
    await waitFor(async () => expect(await goalStorage.load()).toEqual([]));
  });
});

describe('Income view and limit strip', () => {
  const filters = {
    date: today(),
    period: 'Month',
    category: '',
    method: '',
    search: '',
    day: '',
  };
  it('shows money in, money out and the balance without mixing them', async () => {
    await incomeStorage.save({
      id: 'i1',
      date: today(),
      source: 'Allowance',
      amount_cents: 100000,
      note: '',
      created_at: '2026-11-01T00:00:00Z',
    });
    render(<IncomeView filters={filters} spent={25000} />);
    await waitFor(() =>
      expect(screen.getByLabelText('Balance')).toHaveTextContent('S$750.00'),
    );
    expect(screen.getByText('Money in').nextSibling).toHaveTextContent('S$1,000.00');
    expect(screen.getByText('Money out').nextSibling).toHaveTextContent('S$250.00');
    expect(screen.getByRole('button', { name: /Edit Allowance/ })).toBeInTheDocument();
  });
  it('adds income from the form', async () => {
    const user = userEvent.setup();
    render(<IncomeView filters={filters} spent={0} />);
    await user.click(await screen.findByRole('button', { name: '+ Add income' }));
    const dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByLabelText('Amount (SGD)'), '120');
    await user.type(within(dialog).getByLabelText('Source'), 'Tutoring');
    await user.click(within(dialog).getByRole('button', { name: 'Save income' }));
    expect(
      await screen.findByRole('button', { name: /Edit Tutoring, S\$120\.00/ }),
    ).toBeInTheDocument();
    expect((await incomeStorage.load())[0].amount_cents).toBe(12000);
  });
  it('shows the limit only when one is set', () => {
    const { rerender } = render(
      <LimitStrip entries={[]} period="Week" date={today()} onOpen={() => {}} />,
    );
    expect(screen.queryByLabelText('Spending limit this week')).toBeNull();
    savePlan({ Day: null, Week: 10000, Month: null });
    rerender(
      <LimitStrip
        entries={[makeEntry({ id: 'a', date: today(), amount_cents: 12000 })]}
        period="Week"
        date={today()}
        onOpen={() => {}}
      />,
    );
    expect(screen.getByLabelText('Spending limit this week')).toHaveTextContent(
      'S$20.00 over this week',
    );
  });
});

describe('sample finance data', () => {
  it('seeds income, bills, goals and limits, then removes only the samples', async () => {
    await incomeStorage.save({
      id: 'mine',
      date: today(),
      source: 'Mine',
      amount_cents: 100,
      note: '',
      created_at: '2026-11-01T00:00:00Z',
    });
    await seedDemoData();
    expect((await incomeStorage.load()).length).toBeGreaterThan(5);
    expect((await billStorage.load()).length).toBeGreaterThan(10);
    expect(await goalStorage.load()).toHaveLength(3);
    expect(loadPlan().Week).toBe(45000);
    await removeSampleEntries();
    expect((await incomeStorage.load()).map((item) => item.id)).toEqual(['mine']);
    expect(await billStorage.load()).toEqual([]);
    expect(loadPlan().Week).toBeNull();
  });
  it('keeps limits the person set themselves', async () => {
    savePlan({ Day: null, Week: 9900, Month: null });
    await seedDemoData();
    expect(loadPlan().Week).toBe(9900);
  });
});
