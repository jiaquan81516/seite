import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AccountProvider } from '../src/account/AccountProvider';
import { ProfileSettings } from '../src/components/account/ProfileSettings';
import { PreferencesSettings } from '../src/components/account/PreferencesSettings';
import { ACCOUNT_STORAGE_KEY, normalizeAccount } from '../src/lib/account';
import { entryStorage } from '../src/lib/storage';
import TrackerPage from '../src/pages/TrackerPage';

beforeEach(async () => {
  localStorage.clear();
  sessionStorage.clear();
  await entryStorage.clear();
});
afterEach(() => vi.restoreAllMocks());

describe('local profile', () => {
  it('saves a profile only when requested and restores it on reload', async () => {
    const user = userEvent.setup();
    const first = render(
      <AccountProvider>
        <ProfileSettings />
      </AccountProvider>,
    );
    await user.type(screen.getByLabelText('Display name (optional)'), 'Ada Lee');
    await user.type(screen.getByLabelText('Profile email (optional)'), 'ada@example.com');
    await user.click(screen.getByRole('radio', { name: 'Sage' }));
    expect(localStorage.getItem(ACCOUNT_STORAGE_KEY)).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Save profile' }));
    expect(screen.getByRole('status')).toHaveTextContent('Profile saved on this device.');
    expect(screen.getByText('AL')).toBeInTheDocument();
    first.unmount();
    render(
      <AccountProvider>
        <ProfileSettings />
      </AccountProvider>,
    );
    expect(screen.getByLabelText('Display name (optional)')).toHaveValue('Ada Lee');
    expect(screen.getByRole('radio', { name: 'Sage' })).toBeChecked();
  });
  it('discards an unsaved draft without changing storage', async () => {
    const user = userEvent.setup();
    render(
      <AccountProvider>
        <ProfileSettings />
      </AccountProvider>,
    );
    await user.type(screen.getByLabelText('Display name (optional)'), 'Draft');
    await user.click(screen.getByRole('button', { name: 'Discard changes' }));
    expect(screen.getByLabelText('Display name (optional)')).toHaveValue('');
    expect(localStorage.getItem(ACCOUNT_STORAGE_KEY)).toBeNull();
  });
  it('reports storage failure without claiming success', async () => {
    const user = userEvent.setup();
    render(
      <AccountProvider>
        <ProfileSettings />
      </AccountProvider>,
    );
    await user.type(screen.getByLabelText('Display name (optional)'), 'Ada');
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('Full');
    });
    await user.click(screen.getByRole('button', { name: 'Save profile' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Changes could not be saved');
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });
});

describe('preferences', () => {
  it('applies saved period, payment method and reduced motion in the tracker', async () => {
    const user = userEvent.setup();
    const settings = render(
      <AccountProvider>
        <PreferencesSettings />
      </AccountProvider>,
    );
    await user.click(screen.getByLabelText('Open the tracker in'));
    await user.click(screen.getByRole('option', { name: 'Month' }));
    await user.click(screen.getByLabelText('Default payment method'));
    await user.click(screen.getByRole('option', { name: 'Cash' }));
    await user.click(screen.getByRole('checkbox', { name: /Reduce motion/ }));
    await user.click(screen.getByRole('button', { name: 'Save preferences' }));
    expect(document.documentElement.dataset.reduceMotion).toBe('true');
    settings.unmount();
    render(
      <AccountProvider>
        <TrackerPage />
      </AccountProvider>,
    );
    await screen.findByRole('heading', { name: 'Your money, at a glance.' });
    expect(screen.getByRole('button', { name: 'Month' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await user.click(screen.getAllByRole('button', { name: /Add a spend/ })[0]);
    expect(
      within(screen.getByRole('dialog')).getByLabelText('Payment method'),
    ).toHaveTextContent('Cash');
  });
  it('uses safe defaults for invalid stored preference values', () => {
    expect(
      normalizeAccount({
        preferences: {
          defaultPeriod: 'Year',
          defaultMethod: 'Unknown',
          reduceMotion: 'yes',
        },
      }).preferences,
    ).toEqual({ defaultPeriod: 'Day', defaultMethod: '', reduceMotion: false });
  });
});
