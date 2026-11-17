import { useEffect, useState } from 'react';
import { Modal } from '../Modal';
import { openPdf, pdfPageAttachment } from '../../chat/attachments';
export function PdfPagePicker({ file, onSelect, onClose }) {
  const [document, setDocument] = useState(null);
  const [page, setPage] = useState('1');
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState('');
  const pageNumber = Number(page);
  const validPage =
    document &&
    Number.isInteger(pageNumber) &&
    pageNumber >= 1 &&
    pageNumber <= document.numPages;
  useEffect(() => {
    let active = true;
    let opened;
    openPdf(file)
      .then((pdf) => {
        opened = pdf;
        if (active) setDocument(pdf);
        else pdf.destroy();
      })
      .catch(() => {
        if (active)
          setError(
            'This PDF could not be opened. Try an unencrypted PDF or a screenshot of the page.',
          );
      });
    return () => {
      active = false;
      opened?.destroy();
    };
  }, [file]);
  useEffect(() => {
    if (!validPage) return;
    let active = true;
    setPreview(null);
    setError('');
    pdfPageAttachment(document, pageNumber, file.name)
      .then((image) => {
        if (active) setPreview(image);
      })
      .catch(() => {
        if (active)
          setError('That page could not be rendered. Try a screenshot instead.');
      });
    return () => {
      active = false;
    };
  }, [document, pageNumber, validPage, file.name]);
  return (
    <Modal title="Choose one PDF page" onClose={onClose}>
      <p className="muted">
        Only this page will be attached, as an image. The PDF stays on your device. Mark
        bank statements as sensitive to use local Ollama.
      </p>
      {document && (
        <label className="pdf-page-control">
          Page{' '}
          <input
            type="number"
            min="1"
            max={document.numPages}
            value={page}
            onChange={(event) => {
              setPreview(null);
              setPage(event.target.value);
            }}
          />{' '}
          of {document.numPages}
        </label>
      )}
      {document && !validPage && (
        <p className="error" role="alert">
          Choose a page from 1 to {document.numPages}.
        </p>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {preview ? (
        <img
          className="pdf-page-preview"
          src={`data:${preview.mediaType};base64,${preview.data}`}
          alt={`Preview of page ${page}`}
        />
      ) : (
        !error && (!document || validPage) && <p role="status">Opening your page…</p>
      )}
      <button
        className="primary full"
        disabled={!preview || !validPage}
        onClick={() => onSelect(preview)}
      >
        Attach this page
      </button>
    </Modal>
  );
}
