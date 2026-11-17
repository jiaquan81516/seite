import { Modal } from '../components/Modal';
import { useState } from 'react';
import { Brand } from '../components/Brand';
export default function AuthPage({ mode, navigate, onContinue, notice = '' }) {
  const signup = mode === 'signup';
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [passwordHelp, setPasswordHelp] = useState(false);
  function handleSubmit(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (signup && form.get('password') !== form.get('confirmPassword')) {
      setError('Those passwords don’t match. Give it another try.');
      return;
    }
    // This is a visual demo: credentials are never sent, logged or persisted.
    event.currentTarget.reset();
    onContinue();
  }
  return (
    <main className="auth-shell">
      <aside className="auth-story">
        <Brand onClick={() => navigate('home')} />
        <div className="auth-story-copy"></div>
        <div className="auth-decoration" aria-hidden="true">
          <i />
          <i />
          <i />
        </div>
      </aside>
      <section className="auth-content">
        <button className="auth-back plain-link" onClick={() => navigate('home')}>
          ← Back to Seite
        </button>
        <div className="auth-form-card">
          <span className="auth-greeting" aria-hidden="true">
            {signup ? '✧' : '☀'}
          </span>
          <h1>{signup ? 'Create your space' : 'Welcome back'}</h1>
          {notice && (
            <p className="auth-session-notice" role="status">
              {notice}
            </p>
          )}
          <form onSubmit={handleSubmit}>
            {signup && (
              <>
                <label htmlFor="name">Your name</label>
                <input
                  className="field"
                  id="name"
                  name="name"
                  autoComplete="given-name"
                  placeholder="What should we call you?"
                  maxLength={80}
                  required
                />
              </>
            )}
            <label htmlFor="email">Email address</label>
            <input
              className="field"
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              required
            />
            <label htmlFor="password">Password</label>
            <div className="password-field">
              <input
                className="field"
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete={signup ? 'new-password' : 'current-password'}
                placeholder={signup ? 'At least 8 characters' : 'Your password'}
                minLength={signup ? 8 : undefined}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
            {!signup && (
              <button
                className="plain-link password-help"
                type="button"
                onClick={() => setPasswordHelp(true)}
              >
                Forgot password?
              </button>
            )}
            {signup && (
              <>
                <label htmlFor="confirm-password">Confirm password</label>
                <input
                  className="field"
                  id="confirm-password"
                  name="confirmPassword"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="One more time"
                  minLength={8}
                  required
                />
              </>
            )}
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <button className="primary full auth-submit" type="submit">
              {signup ? 'Create my space' : 'Step into your space'}{' '}
              <span aria-hidden="true">↗</span>
            </button>
          </form>
          <p className="auth-switch">
            {signup ? 'Already feel at home?' : 'New around here?'}{' '}
            <button
              className="plain-link"
              onClick={() => navigate(signup ? 'signin' : 'signup')}
            >
              {signup ? 'Sign in' : 'Create your space'}
            </button>
          </p>
          <div className="auth-demo-note">
            <span className="preview-label">Just a preview</span>
            <p>
              No account is created and nothing you type is saved or sent. You can skip
              the form and take a look.
            </p>
            <button className="plain-link" onClick={onContinue}>
              Explore without an account <span aria-hidden="true">→</span>
            </button>
          </div>
        </div>
      </section>
      {passwordHelp && (
        <Modal
          title="No password to reset just yet"
          onClose={() => setPasswordHelp(false)}
        >
          <p>
            These account screens are a preview. Your password is never saved, and no real
            account has been created.
          </p>
          <p className="muted">
            You can explore the tracker without an account. Password recovery will be
            available when real sign-in is connected.
          </p>
          <button className="primary full" onClick={onContinue}>
            Explore without an account
          </button>
          <button className="outline full" onClick={() => setPasswordHelp(false)}>
            Back to sign in
          </button>
        </Modal>
      )}
    </main>
  );
}
