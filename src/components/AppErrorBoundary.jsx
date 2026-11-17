import { Component } from 'react';

// A render failure should offer a way back, rather than leave a blank screen.
export class AppErrorBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="app-error-screen">
        <span className="eyebrow">LET’S TRY THAT AGAIN</span>
        <h1>Something went wrong.</h1>
        <p>This screen couldn’t open. Reload Seite to try again.</p>
        <button className="primary" onClick={() => window.location.reload()}>
          Reload Seite
        </button>
        <p className="field-help">Reloading doesn’t clear your saved entries.</p>
      </main>
    );
  }
}
