import { useAccount } from '../account/AccountProvider';
import { ACCOUNT_SECTIONS } from '../account/navigation';
import { Brand } from '../components/Brand';
import { Avatar } from '../components/account/Avatar';
import { DataSettings } from '../components/account/DataSettings';
import { DemoSettings } from '../components/account/DemoSettings';
import { GmailSettings } from '../components/account/GmailSettings';
import { HelpCenter } from '../components/account/HelpCenter';
import { PreferencesSettings } from '../components/account/PreferencesSettings';
import { PrivacyAbout } from '../components/account/PrivacyAbout';
import { ProfileSettings } from '../components/account/ProfileSettings';
export default function AccountPage({ section, navigate, onSignOut, onDeleted }) {
  const { profile, sessionActive, readError } = useAccount();
  const current = ACCOUNT_SECTIONS.find((item) => item.id === section);
  return (
    <main className="account-shell">
      <header className="account-page-header">
        <Brand onClick={() => navigate('home')} />
        <button className="outline" onClick={() => navigate('tracker')}>
          ← Back to tracker
        </button>
      </header>
      <div className="account-layout">
        <aside className="account-sidebar">
          <div className="sidebar-profile">
            <Avatar profile={profile} large />
            <strong>{profile.name || 'Your space'}</strong>
            <span>{sessionActive ? 'Local preview session' : 'Guest preview'}</span>
          </div>
          <nav aria-label="Account sections">
            {ACCOUNT_SECTIONS.map((item) => (
              <button
                key={item.id}
                className={section === item.id ? 'selected' : ''}
                aria-current={section === item.id ? 'page' : undefined}
                onClick={() => navigate(item.id)}
              >
                <span aria-hidden="true">{item.icon}</span>
                {item.label}
                <span aria-hidden="true">↗</span>
              </button>
            ))}
          </nav>
          <div className="sidebar-signout">
            <button className="plain-link" onClick={onSignOut}>
              Sign out <span aria-hidden="true">→</span>
            </button>
            <p>Your saved entries stay on this device.</p>
          </div>
        </aside>
        <div className="account-main">
          <div className="account-page-title">
            <h1>{current.label}</h1>
            <p>{current.description}</p>
          </div>
          {readError && (
            <p className="error" role="alert">
              {readError}
            </p>
          )}
          {section === 'profile' && <ProfileSettings />}
          {section === 'settings' && <PreferencesSettings />}
          {section === 'data' && <DataSettings onDeleted={onDeleted} />}
          {section === 'gmail' && <GmailSettings navigate={navigate} />}
          {section === 'demo' && <DemoSettings />}
          {section === 'help' && <HelpCenter navigate={navigate} />}
          {section === 'privacy' && <PrivacyAbout navigate={navigate} />}
        </div>
      </div>
    </main>
  );
}
