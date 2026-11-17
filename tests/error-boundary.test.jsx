import { expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AppErrorBoundary } from '../src/components/AppErrorBoundary';

it('offers reload when a screen fails instead of leaving a blank page', () => {
  const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
  function BrokenScreen() {
    throw new Error('Render failed');
  }
  try {
    render(
      <AppErrorBoundary>
        <BrokenScreen />
      </AppErrorBoundary>,
    );
    expect(
      screen.getByRole('heading', { name: 'Something went wrong.' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reload Seite' })).toBeInTheDocument();
  } finally {
    consoleError.mockRestore();
  }
});
