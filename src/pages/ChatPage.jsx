import { useEffect, useState } from 'react';
import { Brand } from '../components/Brand';
import { Modal } from '../components/Modal';
import { ChatComposer } from '../components/chat/ChatComposer';
import { ChatMessages } from '../components/chat/ChatMessages';
import { getAiStatus } from '../chat/api';
import { useChatConversation } from '../chat/useChatConversation';
import { useOnline } from '../hooks/useOnline';
import '../gmail/gmail.css';

export default function ChatPage({ navigate }) {
  const chat = useChatConversation();
  const online = useOnline();
  const [status, setStatus] = useState(null);
  const [statusError, setStatusError] = useState('');
  const [suggestion, setSuggestion] = useState(null);
  const [clearDialog, setClearDialog] = useState(false);
  const [clearError, setClearError] = useState('');
  useEffect(() => {
    let active = true;
    getAiStatus()
      .then((result) => {
        if (active) {
          setStatus(result);
          setStatusError('');
        }
      })
      .catch(() => {
        if (active)
          setStatusError(
            'Receipt reading is unavailable right now. You can still ask for saved spending totals.',
          );
      });
    return () => {
      active = false;
    };
  }, [online]);
  const configured = status?.cloud.some((provider) => provider.configured);
  async function clear() {
    try {
      await chat.clearHistory();
      setClearDialog(false);
    } catch {
      setClearError('History could not be cleared. Please try again.');
    }
  }
  return (
    <main className="chat-shell">
      <header className="account-page-header">
        <Brand onClick={() => navigate('home')} />
        <button className="outline" onClick={() => navigate('tracker')}>
          ← Back to tracker
        </button>
      </header>
      <section className="chat-workspace" aria-label="Seite chat">
        <div className="chat-heading">
          <div className="chat-heading-identity">
            <span className="chat-avatar" aria-hidden="true">
              ✧
            </span>
            <div>
              <h1>Seite chat</h1>
            </div>
          </div>
          <button
            className="text-btn"
            disabled={Boolean(chat.activity) || chat.messages.length === 0}
            onClick={() => {
              setClearDialog(true);
              setClearError('');
            }}
          >
            Clear chat
          </button>
        </div>
        {chat.gmail.connected && (
          <p
            className={`field-help gmail-status${chat.gmail.error ? ' error' : ''}`}
            role="status"
          >
            {chat.gmail.syncing
              ? 'Checking Gmail…'
              : chat.gmail.error ||
                (chat.gmail.scriptStale
                  ? 'Your Gmail script hasn’t run for over 2 hours. Check its trigger in Apps Script.'
                  : chat.gmail.checkedAt
                    ? `${chat.gmail.demo ? 'Demo mode (simulated emails). ' : ''}Gmail checked at ${new Date(chat.gmail.checkedAt).toLocaleTimeString('en-SG', { hour: '2-digit', minute: '2-digit' })}.`
                    : chat.gmail.demo
                      ? 'Demo mode (simulated emails).'
                      : 'Gmail connected.')}
            <button
              type="button"
              className="text-btn"
              disabled={chat.gmail.syncing || Boolean(chat.activity)}
              onClick={() => chat.syncGmail()}
            >
              Check now
            </button>
          </p>
        )}
        {(statusError || (status && !configured)) && (
          <p className="chat-setup-message" role="status">
            {statusError ||
              'Receipt reading needs a Gemini key in the server configuration. Saved spending totals are available here.'}
          </p>
        )}
        {!online && (
          <p className="chat-setup-message" role="status">
            You’re offline. You can still ask about saved spending.
          </p>
        )}
        <ChatMessages
          messages={chat.messages}
          entries={chat.entries}
          activity={chat.activity}
          onSave={chat.saveReview}
          onCorrection={chat.applyCorrection}
          onRefund={chat.refundEntry}
          onCancelReview={chat.cancelReview}
          onApplyAction={chat.applyEntryAction}
          onCancelAction={chat.cancelEntryAction}
          onUndoAction={chat.undoEntryAction}
          onApplyBulk={chat.applyBulkDelete}
          onUndoBulk={chat.undoBulkDelete}
          onApplyRestore={chat.applyRestore}
          onSuggest={(text) => setSuggestion({ text, id: crypto.randomUUID() })}
        />
        <div className="chat-compose-dock">
          {chat.error && (
            <p className="error chat-error" role="alert">
              {chat.error}
            </p>
          )}
          <ChatComposer
            ready={chat.ready}
            suggestion={suggestion}
            busy={Boolean(chat.activity)}
            canCancel={chat.activity === 'sending'}
            onCancel={chat.cancel}
            enabled={Boolean(chat.ready && configured && online)}
            onSend={(text, attachment) =>
              chat.send(text, attachment, {
                mode: 'cloud',
                sensitive: false,
                cloudConsent: true,
                allowFallback: true,
              })
            }
          />
          <p className="chat-footer-note">Review first. Save when it looks right.</p>
        </div>
      </section>
      {clearDialog && (
        <Modal title="Clear this chat history?" onClose={() => setClearDialog(false)}>
          <p>
            Messages and unsaved review cards will be removed. Your saved entries and
            learned merchant categories stay.
          </p>
          {clearError && (
            <p className="error" role="alert">
              {clearError}
            </p>
          )}
          <div className="settings-actions">
            <button className="danger" onClick={clear}>
              Clear history
            </button>
            <button className="outline" onClick={() => setClearDialog(false)}>
              Keep history
            </button>
          </div>
        </Modal>
      )}
    </main>
  );
}
