import { expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SelectField } from '../src/components/SelectField';

it('supports keyboard selection, type-ahead and Escape focus restoration', async () => {
  const onChange = vi.fn();
  const user = userEvent.setup();
  render(
    <>
      <label htmlFor="category">Category</label>
      <SelectField
        id="category"
        options={['Food & Drink', 'Groceries', 'Transport']}
        onValueChange={onChange}
      />
    </>,
  );
  const trigger = screen.getByRole('combobox', { name: 'Category' });
  trigger.focus();
  await user.keyboard('{ArrowDown}');
  expect(screen.getByRole('listbox')).toBeInTheDocument();
  await user.keyboard('g{Enter}');
  expect(onChange).toHaveBeenLastCalledWith('Groceries');
  expect(trigger).toHaveTextContent('Groceries');
  await user.keyboard('{ArrowDown}{Escape}');
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  expect(trigger).toHaveFocus();
});

it('lets filters return to the all-options state', async () => {
  const onChange = vi.fn();
  const user = userEvent.setup();
  render(
    <SelectField
      label="Category"
      defaultValue="Groceries"
      options={['Groceries']}
      placeholder="All categories"
      onValueChange={onChange}
    />,
  );
  await user.click(screen.getByRole('combobox'));
  await user.click(screen.getByRole('option', { name: 'All categories' }));
  expect(onChange).toHaveBeenLastCalledWith('');
  expect(screen.getByRole('combobox')).toHaveTextContent('All categories');
});

it('keeps required validation and the selected value in FormData', async () => {
  const user = userEvent.setup();
  const { container } = render(
    <form>
      <SelectField label="Category" name="category" required options={['Groceries']} />
    </form>,
  );
  const form = container.querySelector('form');
  expect(form.checkValidity()).toBe(false);
  await user.click(screen.getByRole('combobox'));
  await user.click(screen.getByRole('option', { name: 'Groceries' }));
  expect(form.checkValidity()).toBe(true);
  expect(new FormData(form).get('category')).toBe('Groceries');
});
