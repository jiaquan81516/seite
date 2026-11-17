import { AccountProvider } from '../src/account/AccountProvider';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TrackerPage from '../src/pages/TrackerPage';
import { entryStorage } from '../src/lib/storage';
import { today } from '../src/lib/dates';
import { makeEntry } from './fixtures';
vi.mock('../src/lib/storage', () => ({
  entryStorage: { load: vi.fn(), save: vi.fn(), remove: vi.fn() },
}));
beforeEach(() => {
  entryStorage.load.mockResolvedValue([]);
  entryStorage.save.mockResolvedValue();
  entryStorage.remove.mockResolvedValue();
});
async function openApp() {
  const user = userEvent.setup();
  render(
    <AccountProvider>
      <TrackerPage />
    </AccountProvider>,
  );
  await screen.findByRole('heading', { name: 'Your money, at a glance.' });
  return user;
}
async function openSavedEntry(user) {
  await user.click(screen.getByRole('button', { name: /Edit Test cafe/ }));
  return screen.getByRole('dialog');
}
describe('manual tracker', () => {
  it('opens an empty Day view without invented transactions', async () => {
    await openApp();
    expect(screen.getByRole('button', { name: 'Day' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByText('A fresh start.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Install/ })).not.toBeInTheDocument();
    expect(screen.queryByText('Entries', { exact: true })).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Spending total' })).toHaveTextContent(
      'S$0.00',
    );
  });
  it('saves a spend from the form and shows it in the list', async () => {
    const user = await openApp();
    await user.click(screen.getAllByRole('button', { name: /Add a spend/ })[0]);
    const dialog = within(screen.getByRole('dialog'));
    await user.type(dialog.getByLabelText('Merchant'), 'New cafe');
    await user.type(dialog.getByLabelText('Amount (SGD)'), '9.20');
    await user.click(dialog.getByLabelText('Category'));
    await user.click(screen.getByRole('option', { name: 'Food & Drink' }));
    await user.click(dialog.getByLabelText('Payment method'));
    await user.click(screen.getByRole('option', { name: 'Apple Pay' }));
    await user.click(dialog.getByRole('button', { name: 'Save spend' }));
    expect(
      await screen.findByRole('button', { name: /Edit New cafe, S\$9.20/ }),
    ).toBeInTheDocument();
    expect(entryStorage.save).toHaveBeenCalledWith(
      expect.objectContaining({ merchant: 'New cafe', amount_cents: 920, date: today() }),
    );
  });
  it('edits entries while keeping notes out of the list', async () => {
    entryStorage.load.mockResolvedValue([makeEntry({ date: today() })]);
    const user = await openApp();
    expect(screen.queryByText('Personal share')).not.toBeInTheDocument();
    const dialog = within(await openSavedEntry(user));
    expect(dialog.getByLabelText('Note (optional)')).toHaveValue('Personal share');
    await user.clear(dialog.getByLabelText('Amount (SGD)'));
    await user.type(dialog.getByLabelText('Amount (SGD)'), '10.10');
    await user.click(dialog.getByRole('button', { name: 'Save changes' }));
    expect(
      await screen.findByRole('button', { name: /Edit Test cafe, S\$10.10/ }),
    ).toBeInTheDocument();
  });
  it('keeps the form open when storage fails', async () => {
    entryStorage.load.mockResolvedValue([makeEntry({ date: today() })]);
    entryStorage.save.mockRejectedValue(new Error('Storage full'));
    const user = await openApp();
    const dialog = within(await openSavedEntry(user));
    await user.click(dialog.getByRole('button', { name: 'Save changes' }));
    expect(await dialog.findByRole('alert')).toHaveTextContent('Storage full');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
  it('requires confirmation before deleting and allows cancellation', async () => {
    entryStorage.load.mockResolvedValue([makeEntry({ date: today() })]);
    const user = await openApp();
    let dialog = within(await openSavedEntry(user));
    await user.click(dialog.getByRole('button', { name: 'Delete spend' }));
    expect(entryStorage.remove).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    dialog = within(await openSavedEntry(user));
    await user.click(dialog.getByRole('button', { name: 'Delete spend' }));
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete spend' }),
    );
    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: /Edit Test cafe/ }),
      ).not.toBeInTheDocument(),
    );
    expect(entryStorage.remove).toHaveBeenCalledWith('cafe');
  });
  it('filters via chart keyboard interaction and merchant search', async () => {
    entryStorage.load.mockResolvedValue([
      makeEntry({ date: today() }),
      makeEntry({ id: 'shop', merchant: 'Shop', category: 'Groceries', date: today() }),
    ]);
    const user = await openApp();
    screen.getByRole('button', { name: /Filter Groceries/ }).focus();
    await user.keyboard('{Enter}');
    expect(
      screen.queryByRole('button', { name: /Edit Test cafe/ }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Clear filters ×' }));
    await user.type(screen.getByRole('searchbox', { name: 'Merchant' }), 'cafe');
    expect(screen.queryByRole('button', { name: /Edit Shop/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Edit Test cafe/ })).toBeInTheDocument();
  });
  it('switches periods and navigates across month boundaries', async () => {
    entryStorage.load.mockResolvedValue([
      makeEntry({ date: '2026-11-17' }),
      makeEntry({ id: 'october', merchant: 'October shop', date: '2026-10-31' }),
    ]);
    const user = await openApp();
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-11-17' } });
    await user.click(screen.getByRole('button', { name: 'Month' }));
    expect(screen.getByRole('button', { name: 'Month' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: /Edit Test cafe/ })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Previous period' }));
    expect(screen.getByRole('button', { name: /Edit October shop/ })).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Edit Test cafe/ }),
    ).not.toBeInTheDocument();
  });
  it('keeps loaded entries visible while offline', async () => {
    entryStorage.load.mockResolvedValue([makeEntry({ date: today() })]);
    await openApp();
    const original = Object.getOwnPropertyDescriptor(window.navigator, 'onLine');
    Object.defineProperty(window.navigator, 'onLine', {
      configurable: true,
      value: false,
    });
    window.dispatchEvent(new Event('offline'));
    try {
      expect(await screen.findByText('Offline · on this device')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Edit Test cafe/ })).toBeInTheDocument();
    } finally {
      if (original) Object.defineProperty(window.navigator, 'onLine', original);
      else delete window.navigator.onLine;
    }
  });
});
