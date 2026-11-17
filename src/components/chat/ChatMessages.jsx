import { useEffect, useRef } from 'react';
import { ReviewBatch } from './ReviewBatch';
import { EntryActionCard } from './EntryActionCard';
import { ViewSummary } from './ViewSummary';
import '../../view-summary.css';
import { BulkDeleteCard } from './BulkDeleteCard';
import { RestoreCard } from './RestoreCard';
export function ChatMessages({
  messages,
  entries,
  activity,
  onSave,
  onCorrection,
  onRefund,
  onCancelReview,
  onSuggest,
  onApplyAction,
  onCancelAction,
  onUndoAction,
  onApplyBulk,
  onUndoBulk,
  onApplyRestore,
}) {
  const end = useRef(null);
  useEffect(() => {
    end.current?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
  }, [messages.length, activity]);
  return (
    <div
      className="chat-messages"
      role="log"
      aria-label="Conversation"
      aria-live="polite"
      aria-relevant="additions"
    >
      {messages.length === 0 && (
        <section className="chat-empty">
          <span aria-hidden="true">✧</span>
          <h2>Ask or add a spend</h2>
          <p>
            Send a receipt or screenshot, or ask about the spending you’ve already saved.
            I’ll show you every detail before anything is added.
          </p>
          <div className="chat-examples">
            <button
              type="button"
              onClick={() => onSuggest('How much did I spend today?')}
            >
              <span aria-hidden="true">↗</span>
              <strong>Today’s spending</strong>
              <small>Total so far today</small>
            </button>
            <button
              type="button"
              onClick={() => onSuggest('How much did I spend on food this week?')}
            >
              <span aria-hidden="true">◷</span>
              <strong>Food this week</strong>
              <small>Total for the week</small>
            </button>
            <button
              type="button"
              onClick={() => onSuggest('How much did I spend this month?')}
            >
              <span aria-hidden="true">▤</span>
              <strong>The month so far</strong>
              <small>Total for the month</small>
            </button>
          </div>
        </section>
      )}
      {messages.map((message) => (
        <article className={`chat-message message-${message.role}`} key={message.id}>
          <div className="message-speaker">
            {message.role === 'user' ? 'You' : '✧ Seite'}
            {message.sensitive ? ' · local-only' : ''}
          </div>
          <p className="message-text">{message.text}</p>
          {message.attachmentName && (
            <span className="message-attachment">
              ↥ {message.attachmentName} · image not retained
            </span>
          )}
          {message.view && <ViewSummary view={message.view} entries={entries} />}
          {message.reviewCancelled && (
            <p className="field-help" role="status">
              Review cancelled. Unsaved items were discarded.
            </p>
          )}
          {message.action?.type === 'bulk_delete' && (
            <BulkDeleteCard
              message={message}
              disabled={Boolean(activity)}
              onApply={onApplyBulk}
              onCancel={onCancelAction}
              onUndo={onUndoBulk}
            />
          )}
          {message.action?.type === 'restore' && (
            <RestoreCard
              message={message}
              disabled={Boolean(activity)}
              onApply={onApplyRestore}
              onCancel={onCancelAction}
            />
          )}
          {message.action &&
            message.action.type !== 'bulk_delete' &&
            message.action.type !== 'restore' && (
              <EntryActionCard
                message={message}
                disabled={Boolean(activity)}
                onApply={onApplyAction}
                onCancel={onCancelAction}
                onUndo={onUndoAction}
              />
            )}
          {message.correction && (
            <div className="correction-review">
              <p>
                Change this saved entry or draft to{' '}
                <strong>{message.correction.category}</strong> and remember the merchant?
              </p>
              <button
                className="outline"
                disabled={Boolean(activity)}
                onClick={() => onCorrection(message.id, message.correction)}
              >
                Apply category correction
              </button>
            </div>
          )}
          {message.candidates?.length > 0 && (
            <ReviewBatch
              key={message.id}
              message={message}
              entries={entries}
              onSave={onSave}
              onRefund={onRefund}
              onCancel={onCancelReview}
              disabled={Boolean(activity)}
            />
          )}
        </article>
      ))}
      {activity && (
        <p className="chat-activity" role="status">
          <span className="chat-activity-dot" />
          {activity === 'sending'
            ? 'Seite is putting the details together…'
            : 'Saving your changes on this device…'}
        </p>
      )}
      <div ref={end} />
    </div>
  );
}
