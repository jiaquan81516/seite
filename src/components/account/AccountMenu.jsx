import { ACCOUNT_SECTIONS } from '../../account/navigation';
import { useEffect, useRef } from 'react';
import { useAccount } from '../../account/AccountProvider';
import { Avatar } from './Avatar';
export function AccountMenu({ navigate, onSignOut }) {
  const { profile, sessionActive } = useAccount();
  const details = useRef(null);
  useEffect(() => {
    function closeOutside(event) {
      if (!details.current?.contains(event.target)) details.current.open = false;
    }
    function closeOnEscape(event) {
      if (event.key === 'Escape' && details.current?.open) {
        details.current.open = false;
        details.current.querySelector('summary').focus();
      }
    }
    document.addEventListener('pointerdown', closeOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, []);
  function visit(page) {
    details.current.open = false;
    navigate(page);
  }
  return (
    <details className="account-menu" ref={details}>
      <summary aria-label="Open account menu">
        <Avatar profile={profile} />
        <span className="account-chevron" aria-hidden="true">
          ⌄
        </span>
      </summary>
      <div className="account-popover">
        <div className="account-menu-heading">
          <strong>{profile.name || 'Your space'}</strong>
          <span>{sessionActive ? 'Local preview session' : 'Guest preview'}</span>
        </div>
        <nav aria-label="Account">
          {ACCOUNT_SECTIONS.map((section) => (
            <button key={section.id} onClick={() => visit(section.id)}>
              <span aria-hidden="true">{section.icon}</span>
              {section.label}
              <span aria-hidden="true">↗</span>
            </button>
          ))}
        </nav>
        <button
          className="account-signout"
          onClick={() => {
            details.current.open = false;
            onSignOut();
          }}
        >
          Sign out <span aria-hidden="true">→</span>
        </button>
      </div>
    </details>
  );
}
