export function Brand({ onClick, light = false }) {
  return (
    <button
      className={`brand brand-link ${light ? 'brand-light' : ''}`}
      onClick={onClick}
      aria-label="Seite home"
    >
      <i aria-hidden="true" />
      seite<span className="brand-period">.</span>
    </button>
  );
}
