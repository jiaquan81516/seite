import { useEffect, useState } from 'react';
import { normalizeTime, nowTime } from '../lib/dates';
import '../time-field.css';

// A time input that always works in hours and minutes (no seconds), with quick
// "Now" and "Clear" actions. Works controlled (value + onChange) in the review
// card and uncontrolled (name + defaultValue) in the entry form.
export function TimeField({ id, name, value, defaultValue = '', onChange, disabled }) {
  const controlled = value !== undefined;
  const [current, setCurrent] = useState(() =>
    normalizeTime(controlled ? value : defaultValue),
  );
  useEffect(() => {
    if (controlled) setCurrent(normalizeTime(value));
  }, [controlled, value]);
  function update(next) {
    setCurrent(next);
    onChange?.(next);
  }
  return (
    <div className="time-field">
      <input
        className="field"
        id={id}
        name={name}
        type="time"
        step="60"
        value={current}
        disabled={disabled}
        onChange={(event) => update(event.target.value)}
      />
      <div className="time-field-actions">
        <button
          type="button"
          className="text-btn"
          disabled={disabled}
          aria-label="Set to the current time"
          onClick={() => update(nowTime())}
        >
          Now
        </button>
        {current && (
          <button
            type="button"
            className="text-btn"
            disabled={disabled}
            aria-label="Clear the time"
            onClick={() => update('')}
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );
}
