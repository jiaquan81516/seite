import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AccountProvider } from '../src/account/AccountProvider';
import { DataSettings } from '../src/components/account/DataSettings';
import { createBackup, downloadEntries } from '../src/lib/backups';
import { ACCOUNT_STORAGE_KEY } from '../src/lib/account';
import { entryStorage } from '../src/lib/storage';
import { makeEntry } from './fixtures';
vi.mock('../src/lib/backups', async (importOriginal) => ({
  ...(await importOriginal()),
  downloadEntries: vi.fn(),
}));
beforeEach(async () => {
  localStorage.clear();
  sessionStorage.clear();
  await entryStorage.clear();
});
afterEach(() => vi.restoreAllMocks());
async function openData(onDeleted = vi.fn()) {
  const user = userEvent.setup();
  render(
    <AccountProvider>
      <DataSettings onDeleted={onDeleted} />
    </AccountProvider>,
  );
  await screen.findByRole('heading', { name: /saved entries/ });
  return user;
}
function backupFile(records) {
  const text = createBackup(records);
  const file = new File([text], 'entries.json', { type: 'application/json' });
  // File.text is available in supported browsers; jsdom's File needs a stub.
  file.text = async () => text;
  return file;
}
describe('data controls', () => {
  it('exports all entries as CSV and a restorable JSON backup', async () => {
    await entryStorage.save(makeEntry());
    const user = await openData();
    await user.click(screen.getByRole('button', { name: 'Export CSV' }));
    await waitFor(() =>
      expect(downloadEntries).toHaveBeenCalledWith(
        expect.stringContaining('"9.20"'),
        'csv',
        expect.any(String),
      ),
    );
    await user.click(screen.getByRole('button', { name: 'Download JSON backup' }));
    await waitFor(() =>
      expect(downloadEntries).toHaveBeenCalledWith(
        expect.stringContaining('"format": "seite-backup"'),
        'json',
        'application/json',
      ),
    );
  });
  it('reviews a restore before writing and skips previously restored IDs', async () => {
    const entry = makeEntry();
    const user = await openData();
    await user.upload(screen.getByLabelText('Seite backup file'), backupFile([entry]));
    const dialog = within(await screen.findByRole('dialog'));
    expect(await entryStorage.load()).toEqual([]);
    await user.click(dialog.getByRole('button', { name: 'Restore entries' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(await entryStorage.load()).toEqual([entry]);
    await user.upload(screen.getByLabelText('Seite backup file'), backupFile([entry]));
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('Nothing new to restore'),
    );
    expect(await entryStorage.load()).toHaveLength(1);
  });
  it('rejects a conflicting restore without changing saved records', async () => {
    const existing = makeEntry();
    await entryStorage.save(existing);
    const user = await openData();
    await user.upload(
      screen.getByLabelText('Seite backup file'),
      backupFile([makeEntry({ amount_cents: 1000 })]),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent('conflicts');
    expect(await entryStorage.load()).toEqual([existing]);
  });
  it('allows cancellation and requires the exact deletion phrase', async () => {
    await entryStorage.save(makeEntry());
    const onDeleted = vi.fn();
    const user = await openData(onDeleted);
    await user.click(screen.getByRole('button', { name: 'Delete all local data' }));
    let dialog = within(screen.getByRole('dialog'));
    expect(
      dialog.getByRole('button', { name: 'Permanently delete local data' }),
    ).toBeDisabled();
    await user.click(dialog.getByRole('button', { name: 'Keep my data' }));
    expect(await entryStorage.load()).toHaveLength(1);
    localStorage.setItem(ACCOUNT_STORAGE_KEY, '{}');
    localStorage.setItem('unrelated-data', 'keep');
    await user.click(screen.getByRole('button', { name: 'Delete all local data' }));
    dialog = within(screen.getByRole('dialog'));
    await user.type(dialog.getByLabelText('Type DELETE to confirm'), 'DELETE');
    await user.click(
      dialog.getByRole('button', { name: 'Permanently delete local data' }),
    );
    await waitFor(() => expect(onDeleted).toHaveBeenCalledOnce());
    expect(await entryStorage.load()).toEqual([]);
    expect(localStorage.getItem(ACCOUNT_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem('unrelated-data')).toBe('keep');
  });
  it('keeps local profile data when deleting entries fails', async () => {
    localStorage.setItem(ACCOUNT_STORAGE_KEY, '{}');
    const onDeleted = vi.fn();
    const user = await openData(onDeleted);
    vi.spyOn(entryStorage, 'clear').mockRejectedValue(new Error('Storage unavailable'));
    await user.click(screen.getByRole('button', { name: 'Delete all local data' }));
    await user.type(screen.getByLabelText('Type DELETE to confirm'), 'DELETE');
    await user.click(
      screen.getByRole('button', { name: 'Permanently delete local data' }),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent('Storage unavailable');
    expect(onDeleted).not.toHaveBeenCalled();
    expect(localStorage.getItem(ACCOUNT_STORAGE_KEY)).toBe('{}');
  });
});
