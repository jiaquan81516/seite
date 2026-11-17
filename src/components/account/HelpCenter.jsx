import { useState } from 'react';
import { HELP_QUESTIONS as QUESTIONS } from '../../../shared/app-guide';
export function HelpCenter({ navigate }) {
  const [search, setSearch] = useState('');
  const questions = QUESTIONS.filter((question) =>
    `${question.title} ${question.text}`.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <section className="panel account-panel">
      <h2>Help topics</h2>
      <label htmlFor="help-search">Search help</label>
      <input
        className="field"
        id="help-search"
        type="search"
        placeholder="Try “backup”, “offline” or “sign out”…"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
      <p className="field-help" role="status">
        {questions.length} helpful answers
      </p>
      <div className="help-questions">
        {questions.map((question) => (
          <details key={question.title}>
            <summary>{question.title}</summary>
            <p>{question.text}</p>
          </details>
        ))}
      </div>
      {questions.length === 0 && (
        <p>
          No matching answers. Try a shorter search, or clear your search to see
          everything.
        </p>
      )}
      <div className="help-next">
        <span>Want to keep a copy of your entries?</span>
        <button className="outline" onClick={() => navigate('data')}>
          Open your data ↗
        </button>
      </div>
    </section>
  );
}
