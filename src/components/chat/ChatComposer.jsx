import { useEffect, useRef, useState } from 'react';
import { imageAttachment } from '../../chat/attachments';
import { PdfPagePicker } from './PdfPagePicker';
import { spendingFactId } from '../../chat/local-answer';
import { isRecentRemoval } from '../../chat/entry-actions';
export function ChatComposer({
  onSend,
  busy,
  canCancel,
  onCancel,
  enabled,
  ready,
  suggestion,
}) {
  const [text, setText] = useState('');
  const [attachment, setAttachment] = useState(null);
  const [pdf, setPdf] = useState(null);
  const [preparing, setPreparing] = useState(false);
  const [error, setError] = useState('');
  const submitting = useRef(false);
  const messageInput = useRef(null);
  useEffect(() => {
    if (!suggestion) return;
    setText(suggestion.text);
    messageInput.current?.focus();
  }, [suggestion]);
  const localQuestion =
    ready && !attachment && !pdf && (spendingFactId(text) || isRecentRemoval(text));
  const canSend =
    !busy &&
    !preparing &&
    !pdf &&
    (enabled || localQuestion) &&
    Boolean(text.trim() || attachment);
  async function attach(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setError('');
    if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) {
      setPdf(file);
      return;
    }
    setAttachment(null);
    setPreparing(true);
    try {
      setAttachment(await imageAttachment(file));
    } catch (error) {
      setError(error.message);
    } finally {
      setPreparing(false);
    }
  }
  async function submit(event) {
    event.preventDefault();
    if (!canSend || submitting.current) return;
    setError('');
    submitting.current = true;
    try {
      const sent = await onSend(text.trim(), attachment);
      if (sent) {
        setText('');
        setAttachment(null);
      }
    } finally {
      submitting.current = false;
    }
  }
  function handleKeyDown(event) {
    if (
      event.key !== 'Enter' ||
      event.shiftKey ||
      event.nativeEvent.isComposing ||
      event.nativeEvent.keyCode === 229
    )
      return;
    event.preventDefault();
    if (!event.repeat) event.currentTarget.form.requestSubmit();
  }
  return (
    <>
      <form className="chat-composer panel" onSubmit={submit}>
        {attachment && (
          <div className="attachment-preview">
            <img
              src={`data:${attachment.mediaType};base64,${attachment.data}`}
              alt="Selected attachment"
            />
            <div>
              <strong>{attachment.name}</strong>
              <span>Ready to read · review before saving</span>
            </div>
            <button
              type="button"
              className="icon-btn"
              disabled={busy}
              aria-label="Remove attachment"
              onClick={() => setAttachment(null)}
            >
              ×
            </button>
          </div>
        )}
        <label htmlFor="chat-message">Ask Seite or send a receipt</label>
        <textarea
          ref={messageInput}
          id="chat-message"
          rows="2"
          maxLength="2000"
          placeholder="Ask about your spending, or add a receipt…"
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={handleKeyDown}
          aria-describedby="chat-keyboard-hint"
          disabled={busy}
        />
        <p className="field-help" id="chat-keyboard-hint">
          Enter to send · Shift+Enter for a new line
        </p>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <div className="composer-actions">
          <div className="attachment-actions">
            <label className={`chat-attach ${busy || preparing ? 'disabled' : ''}`}>
              ＋ <span>{preparing ? 'Preparing…' : 'Photo or PDF'}</span>
              <input
                type="file"
                accept="image/*,.heic,.heif,.heics,.heifs,application/pdf"
                disabled={busy || preparing}
                onChange={attach}
              />
            </label>
            <label className={`chat-attach ${busy || preparing ? 'disabled' : ''}`}>
              <span>Take photo</span>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                disabled={busy || preparing}
                onChange={attach}
              />
            </label>
          </div>

          {busy ? (
            <button
              type="button"
              className="outline"
              disabled={!canCancel}
              onClick={onCancel}
            >
              {canCancel ? 'Cancel' : 'Saving…'}
            </button>
          ) : (
            <button className="primary" disabled={!canSend}>
              Send ↗
            </button>
          )}
        </div>
      </form>
      {pdf && (
        <PdfPagePicker
          file={pdf}
          onClose={() => setPdf(null)}
          onSelect={(image) => {
            setAttachment(image);
            setPdf(null);
          }}
        />
      )}
    </>
  );
}
