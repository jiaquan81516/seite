import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../src/App';
import AuthPage from '../src/pages/AuthPage';
import { LOADING_DURATION, SeiteLoader } from '../src/components/SeiteLoader';
vi.mock('../src/lib/storage', () => ({
  entryStorage: { load: vi.fn().mockResolvedValue([]), save: vi.fn(), remove: vi.fn() },
}));
beforeEach(() => {
  window.history.replaceState(null, '', '/');
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
});
describe('welcome and account preview', () => {
  it('introduces the app and distinguishes the future AI flow from the working tracker', () => {
    render(<App />);
    expect(
      screen.getByRole('heading', { name: /Track your spending/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Link your inbox.' })).toBeInTheDocument();
    expect(screen.getByText(/Email linking is next/)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Explore the tracker/ }),
    ).toBeInTheDocument();
  });
  it('navigates from sign-in through the liquid loader to the working tracker', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    await screen.findByRole('heading', { name: 'Welcome back' });
    await user.type(screen.getByLabelText('Email address'), 'demo@example.com');
    await user.type(
      screen.getByLabelText('Password', { exact: true }),
      'demo-only-password',
    );
    await user.click(screen.getByRole('button', { name: /Step into your space/ }));
    expect(
      await screen.findByRole('heading', { name: /Opening your tracker/ }),
    ).toBeInTheDocument();
    expect(screen.getByText(/No email connection is being made/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Open tracker now/ }));
    expect(
      await screen.findByRole('heading', { name: 'Your money, at a glance.' }),
    ).toBeInTheDocument();
    expect(window.location.hash).toBe('#/tracker');
    expect(window.location.href).not.toContain('demo@example.com');
    await user.click(screen.getByRole('button', { name: 'Seite home' }));
    expect(
      await screen.findByRole('heading', { name: /Track your spending/ }),
    ).toBeInTheDocument();
  });
  it('opens sign-up directly and can switch to sign-in', async () => {
    window.history.replaceState(null, '', '/#/signup');
    const user = userEvent.setup();
    render(<App />);
    expect(
      screen.getByRole('heading', { name: 'Create your space' }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Confirm password')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(
      await screen.findByRole('heading', { name: 'Welcome back' }),
    ).toBeInTheDocument();
  });
  it('checks matching passwords and clears credentials before opening the demo', async () => {
    const onContinue = vi.fn();
    const user = userEvent.setup();
    render(<AuthPage mode="signup" navigate={vi.fn()} onContinue={onContinue} />);
    await user.type(screen.getByLabelText('Your name'), 'Demo');
    await user.type(screen.getByLabelText('Email address'), 'demo@example.com');
    await user.type(screen.getByLabelText('Password', { exact: true }), 'abcdefgh');
    await user.type(screen.getByLabelText('Confirm password'), 'different');
    await user.click(screen.getByRole('button', { name: /Create my space/ }));
    expect(screen.getByRole('alert')).toHaveTextContent('Those passwords don’t match');
    expect(onContinue).not.toHaveBeenCalled();
    await user.clear(screen.getByLabelText('Confirm password'));
    await user.type(screen.getByLabelText('Confirm password'), 'abcdefgh');
    await user.click(screen.getByRole('button', { name: /Create my space/ }));
    expect(onContinue).toHaveBeenCalledOnce();
    expect(screen.getByLabelText('Email address')).toHaveValue('');
    expect(screen.getByLabelText('Password', { exact: true })).toHaveValue('');
  });
  it('lets visitors skip account entry entirely', async () => {
    const onContinue = vi.fn();
    const user = userEvent.setup();
    render(<AuthPage mode="signin" navigate={vi.fn()} onContinue={onContinue} />);
    await user.click(screen.getByRole('button', { name: /Explore without an account/ }));
    expect(onContinue).toHaveBeenCalledOnce();
  });
});
describe('liquid loading sequence', () => {
  it('updates the captions and completes automatically', async () => {
    vi.useFakeTimers();
    try {
      const onReady = vi.fn();
      render(<SeiteLoader onReady={onReady} onCancel={vi.fn()} />);
      const status = within(screen.getByRole('status'));
      expect(status.getByRole('heading')).toHaveTextContent('Opening your tracker');
      await act(() => vi.advanceTimersByTimeAsync(1100));
      expect(status.getByRole('heading')).toHaveTextContent('Getting your space ready');
      await act(() => vi.advanceTimersByTimeAsync(1300));
      expect(status.getByRole('heading')).toHaveTextContent('Your tracker is ready.');
      expect(onReady).not.toHaveBeenCalled();
      await act(() => vi.advanceTimersByTimeAsync(LOADING_DURATION - 2400));
      expect(onReady).toHaveBeenCalledOnce();
    } finally {
      vi.useRealTimers();
    }
  });
  it('cancels its timer when the user leaves the loading screen', async () => {
    vi.useFakeTimers();
    try {
      const onReady = vi.fn();
      const { unmount } = render(<SeiteLoader onReady={onReady} onCancel={vi.fn()} />);
      unmount();
      await act(() => vi.advanceTimersByTimeAsync(LOADING_DURATION));
      expect(onReady).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});
