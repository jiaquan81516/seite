const MAX_BYTES = 10 * 1024 * 1024;
function fileBytes(file) {
  if (file.size > MAX_BYTES) throw new Error('Choose a file smaller than 10 MB.');
  return file.arrayBuffer();
}
export { imageAttachment } from './images';

export async function openPdf(file) {
  const data = await fileBytes(file);
  const pdfjs = await import('pdfjs-dist');
  const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  return pdfjs.getDocument({ data, isEvalSupported: false }).promise;
}
export async function pdfPageAttachment(document, pageNumber, name) {
  const page = await document.getPage(pageNumber);
  const base = page.getViewport({ scale: 1 });
  const viewport = page.getViewport({
    scale: Math.min(2, 2000 / Math.max(base.width, base.height)),
  });
  const canvas = window.document.createElement('canvas');
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  await page.render({ canvasContext: canvas.getContext('2d'), canvas, viewport }).promise;
  return {
    name: `${name} · page ${pageNumber}`,
    mediaType: 'image/jpeg',
    data: canvas.toDataURL('image/jpeg', 0.92).split(',')[1],
  };
}
