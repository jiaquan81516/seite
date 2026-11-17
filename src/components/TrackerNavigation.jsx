import { createPortal } from 'react-dom';

export function TrackerNavigation({ onAdd, onChat }) {
  // Keep fixed navigation outside animated pages: transforms on ancestors
  // would otherwise make it scroll with the page instead of the viewport.
  return createPortal(
    <nav className="tracker-nav" aria-label="Tracker actions">
      <button className="text-btn" onClick={onChat}>
        ✧ AI chat
      </button>
      <button className="primary" onClick={onAdd}>
        + Add a spend
      </button>
    </nav>,
    document.body,
  );
}
