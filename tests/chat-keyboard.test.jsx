import { expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChatComposer } from '../src/components/chat/ChatComposer';

it('sends with Enter and clears the composer on success', async () => {
  const send = vi.fn().mockResolvedValue(true);
  const user = userEvent.setup();
  render(<ChatComposer onSend={send} enabled cloud />);
  const input = screen.getByLabelText('Ask Seite or send a receipt');
  await user.type(input, 'Read my receipt{Enter}');
  expect(send).toHaveBeenCalledExactlyOnceWith('Read my receipt', null);
  expect(input).toHaveValue('');
});

it('inserts a new line with Shift+Enter', async () => {
  const send = vi.fn();
  const user = userEvent.setup();
  render(<ChatComposer onSend={send} enabled cloud />);
  const input = screen.getByLabelText('Ask Seite or send a receipt');
  await user.type(input, 'First line{Shift>}{Enter}{/Shift}Second line');
  expect(input).toHaveValue('First line\nSecond line');
  expect(send).not.toHaveBeenCalled();
});

it('does not send when disabled or submit an empty message with Enter', async () => {
  const send = vi.fn();
  const user = userEvent.setup();
  const { rerender } = render(<ChatComposer onSend={send} enabled cloud />);
  const input = screen.getByLabelText('Ask Seite or send a receipt');
  await user.type(input, '{Enter}');
  rerender(<ChatComposer onSend={send} enabled={false} cloud />);
  await user.type(input, 'Read my receipt{Enter}');
  expect(send).not.toHaveBeenCalled();
  expect(input).toHaveValue('Read my receipt');
});

it('keeps IME confirmation and held Enter from submitting', () => {
  const send = vi.fn();
  render(<ChatComposer onSend={send} enabled cloud />);
  const input = screen.getByLabelText('Ask Seite or send a receipt');
  fireEvent.change(input, { target: { value: '午餐' } });
  fireEvent.keyDown(input, { key: 'Enter', isComposing: true });
  fireEvent.keyDown(input, { key: 'Enter', keyCode: 229 });
  fireEvent.keyDown(input, { key: 'Enter', repeat: true });
  expect(send).not.toHaveBeenCalled();
});

it('does not send twice while the first submission is pending', async () => {
  let finish;
  const send = vi.fn(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const user = userEvent.setup();
  render(<ChatComposer onSend={send} enabled cloud />);
  await user.type(
    screen.getByLabelText('Ask Seite or send a receipt'),
    'Read my receipt{Enter}{Enter}',
  );
  expect(send).toHaveBeenCalledTimes(1);
  finish(false);
});
