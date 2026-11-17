import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import { AppErrorBoundary } from './components/AppErrorBoundary';
import './styles.css';
import './welcome.css';
import './account.css';
import './chat.css';
import './demo.css';
import './finance.css';
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </StrictMode>,
);
registerSW({
  onRegisterError(error) {
    console.error('Offline setup failed. Reload while online to try again.', error);
  },
});
