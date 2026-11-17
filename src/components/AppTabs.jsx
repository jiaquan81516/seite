const TABS = [
  { id: 'tracker', label: 'Spending' },
  { id: 'bills', label: 'Bills' },
  { id: 'plan', label: 'Plan' },
];

export function AppTabs({ page, navigate }) {
  return (
    <nav className="app-tabs" aria-label="Sections">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          className={page === tab.id ? 'active' : ''}
          aria-current={page === tab.id ? 'page' : undefined}
          onClick={() => navigate(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  );
}
