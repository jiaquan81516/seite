import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../src/App';
import { ACCOUNT_STORAGE_KEY, PREVIEW_SESSION_KEY } from '../src/lib/account';
import { entryStorage } from '../src/lib/storage';
import { makeEntry } from './fixtures';
import { today } from '../src/lib/dates';
beforeEach(async () => {
  localStorage.clear();
  sessionStorage.clear();
  await entryStorage.clear();
  window.history.replaceState(null, '', '/#/tracker');
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
});
describe('account navigation', () => {
  it('opens profile from the tracker menu and returns to the tracker', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole('heading', { name: 'Your money, at a glance.' });
    await user.click(screen.getByLabelText('Open account menu'));
    await user.click(screen.getByRole('button', { name: 'My profile' }));
    await screen.findByRole('heading', { name: 'My profile' });
    await user.click(screen.getByRole('button', { name: /Back to tracker/ }));
    expect(
      await screen.findByRole('heading', { name: 'Your money, at a glance.' }),
    ).toBeInTheDocument();
  });
  it('ends the local session without deleting entries or profile', async () => {
    const entry = makeEntry({ date: today() });
    await entryStorage.save(entry);
    sessionStorage.setItem(PREVIEW_SESSION_KEY, 'active');
    localStorage.setItem(
      ACCOUNT_STORAGE_KEY,
      JSON.stringify({ profile: { name: 'Ada' } }),
    );
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole('heading', { name: 'Your money, at a glance.' });
    await user.click(screen.getByLabelText('Open account menu'));
    await user.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(
      await screen.findByRole('heading', { name: 'Welcome back' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('You’ve signed out');
    expect(sessionStorage.getItem(PREVIEW_SESSION_KEY)).toBeNull();
    expect(await entryStorage.load()).toEqual([entry]);
    expect(localStorage.getItem(ACCOUNT_STORAGE_KEY)).toContain('Ada');
  });
  it('searches help and explains the actual local-only status', async () => {
    window.history.replaceState(null, '', '/#/help');
    const user = userEvent.setup();
    render(<App />);
    await user.type(screen.getByLabelText('Search help'), 'Gmail');
    await user.click(screen.getByText('Can I connect Gmail or use the AI bot now?'));
    expect(
      screen.getByText(/Gmail is connected from the Gmail page/),
    ).toBeInTheDocument();
  });
  it('provides a password-help path without pretending to send a reset email', async () => {
    window.history.replaceState(null, '', '/#/signin');
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Forgot password?' }));
    expect(screen.getByRole('dialog')).toHaveTextContent('Your password is never saved');
    await user.click(screen.getByRole('button', { name: 'Back to sign in' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
