import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { normalizeTime, nowTime } from '../src/lib/dates';
import { TimeField } from '../src/components/TimeField';
import { candidateToEntry } from '../src/chat/review';
import { createEntry } from '../src/lib/transactions';
import { formFields } from './fixtures';

describe('normalizeTime', () => {
  it.each([
    ['21:38', '21:38'],
    ['21:38:08', '21:38'],
    ['9:05', '09:05'],
    ['09:38:08 PM', '21:38'],
    ['9:38 pm', '21:38'],
    ['12:00 AM', '00:00'],
    ['12:30 PM', '12:30'],
    ['9.38pm', '21:38'],
    ['', ''],
    [null, ''],
  ])('turns %s into %s', (input, expected) => {
    expect(normalizeTime(input)).toBe(expected);
  });
  it.each(['24:00', '12:60', '25:10', '13:00 PM', 'noon', '9'])('rejects %s', (input) => {
    expect(normalizeTime(input)).toBe('');
  });
  it('gives the current Singapore time as hours and minutes', () => {
    expect(nowTime()).toMatch(/^([01]\d|2[0-3]):[0-5]\d$/);
  });
});

describe('the time that broke saving (HH:MM:SS from the AI)', () => {
  const fields = {
    merchant: 'Bean & Matcha',
    amount: '12.00',
    currency: 'SGD',
    date: '2026-07-05',
    time: '21:38:08',
    category: 'Food & Drink',
    method: 'PayLah',
  };
  it('saves a review candidate whose time includes seconds', () => {
    const entry = candidateToEntry(
      { id: 'c1', kind: 'expense', confidence: 0.95, notes: '' },
      'm1',
      fields,
    );
    expect(entry.time).toBe('21:38');
  });
  it('still rejects a time that is genuinely invalid', () => {
    expect(() =>
      candidateToEntry({ id: 'c1', kind: 'expense', confidence: 0.95, notes: '' }, 'm1', {
        ...fields,
        time: '25:99',
      }),
    ).toThrow('Choose a valid time.');
  });
  it('accepts seconds and 12-hour text in the entry form too', () => {
    expect(createEntry({ ...formFields, time: '21:38:08' }).time).toBe('21:38');
    expect(createEntry({ ...formFields, time: '9:38 PM' }).time).toBe('21:38');
    expect(createEntry({ ...formFields, time: '' }).time).toBe('');
    expect(() => createEntry({ ...formFields, time: '99:99' })).toThrow('valid time');
  });
});

describe('TimeField', () => {
  function Harness({ initial }) {
    const [value, setValue] = useState(initial);
    return (
      <>
        <label htmlFor="t">Time</label>
        <TimeField id="t" value={value} onChange={setValue} />
        <output aria-label="stored">{value}</output>
      </>
    );
  }
  it('drops seconds from a value it is given and never shows them', () => {
    render(<Harness initial="21:38:08" />);
    expect(screen.getByLabelText('Time')).toHaveValue('21:38');
    expect(screen.getByLabelText('Time')).toHaveAttribute('step', '60');
  });
  it('sets the current time with Now and removes it with Clear', async () => {
    const user = userEvent.setup();
    render(<Harness initial="" />);
    expect(
      screen.queryByRole('button', { name: 'Clear the time' }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Set to the current time' }));
    expect(screen.getByLabelText('Time')).toHaveValue(nowTime());
    await user.click(screen.getByRole('button', { name: 'Clear the time' }));
    expect(screen.getByLabelText('Time')).toHaveValue('');
    expect(screen.getByLabelText('stored')).toHaveTextContent('');
  });
  it('submits with a form when uncontrolled', async () => {
    const user = userEvent.setup();
    const submit = vi.fn((event) => {
      event.preventDefault();
      submit.value = new FormData(event.currentTarget).get('time');
    });
    render(
      <form onSubmit={submit}>
        <TimeField id="t" name="time" defaultValue="08:15:30" />
        <button>Go</button>
      </form>,
    );
    await user.click(screen.getByRole('button', { name: 'Go' }));
    expect(submit.value).toBe('08:15');
  });
  it('is disabled together with its buttons', () => {
    render(<TimeField id="t" value="10:00" disabled />);
    expect(screen.getByDisplayValue('10:00')).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Set to the current time' }),
    ).toBeDisabled();
  });
});
