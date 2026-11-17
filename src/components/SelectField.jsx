import { useCallback, useState } from 'react';
import * as Select from '@radix-ui/react-select';
import { CATEGORIES, categoryColor } from '../lib/config';
import '../forms.css';

// One dropdown for forms, receipt reviews and filters. Radix handles focus,
// type-ahead, keyboard navigation and the native form value.
export function SelectField({
  id,
  name,
  value,
  defaultValue = '',
  onValueChange,
  options,
  placeholder = 'Choose an option',
  required,
  disabled,
  label,
}) {
  const [selection, setSelection] = useState(defaultValue);
  const [container, setContainer] = useState(undefined);
  const attachTrigger = useCallback((node) => {
    setContainer(node?.closest('dialog') ?? undefined);
  }, []);
  const current = value ?? selection;
  const items = options.map((option) =>
    typeof option === 'string' ? { value: option, label: option } : option,
  );
  function change(next) {
    const selected = next === '__empty__' ? '' : next;
    setSelection(selected);
    onValueChange?.(selected);
  }
  return (
    <Select.Root
      name={name}
      value={current}
      onValueChange={change}
      required={required}
      disabled={disabled}
    >
      <Select.Trigger
        ref={attachTrigger}
        id={id}
        className="field select-trigger"
        aria-label={label}
      >
        <Select.Value placeholder={placeholder} />
        <Select.Icon className="select-chevron">⌄</Select.Icon>
      </Select.Trigger>
      <Select.Portal container={container}>
        <Select.Content
          className="select-menu"
          position="popper"
          sideOffset={7}
          collisionPadding={12}
        >
          <Select.ScrollUpButton className="select-scroll">⌃</Select.ScrollUpButton>
          <Select.Viewport className="select-viewport">
            {!required && (
              <Select.Item className="select-option" value="__empty__">
                <Select.ItemText>{placeholder}</Select.ItemText>
                <Select.ItemIndicator className="select-check">✓</Select.ItemIndicator>
              </Select.Item>
            )}
            {items.map((item) => (
              <Select.Item key={item.value} className="select-option" value={item.value}>
                {CATEGORIES.includes(item.value) && (
                  <span
                    aria-hidden="true"
                    className="option-dot"
                    style={{ background: categoryColor(item.value) }}
                  />
                )}
                <Select.ItemText>{item.label}</Select.ItemText>
                <Select.ItemIndicator className="select-check">✓</Select.ItemIndicator>
              </Select.Item>
            ))}
          </Select.Viewport>
          <Select.ScrollDownButton className="select-scroll">⌄</Select.ScrollDownButton>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}
