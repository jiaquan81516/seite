import { expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChatComposer } from '../src/components/chat/ChatComposer';
import { openPdf, pdfPageAttachment } from '../src/chat/attachments';
vi.mock('../src/chat/attachments', () => ({
  openPdf: vi.fn(),
  pdfPageAttachment: vi.fn(),
  imageAttachment: vi.fn(),
}));
it('attaches only a chosen rendered PDF page, never the whole PDF', async () => {
  openPdf.mockResolvedValue({ numPages: 2, destroy: vi.fn() });
  pdfPageAttachment.mockImplementation(async (_, page) => ({
    name: `Statement · page ${page}`,
    mediaType: 'image/jpeg',
    data: `page${page}`,
  }));
  const send = vi.fn().mockResolvedValue(true);
  const user = userEvent.setup();
  render(<ChatComposer onSend={send} enabled cloud busy={false} onCancel={vi.fn()} />);
  await user.upload(
    screen.getByLabelText(/Photo or PDF/),
    new File(['whole-pdf-bytes'], 'statement.pdf', { type: 'application/pdf' }),
  );
  const page = await screen.findByRole('spinbutton');
  await user.clear(page);
  await user.type(page, '2');
  await screen.findByAltText('Preview of page 2');
  await user.click(screen.getByRole('button', { name: 'Attach this page' }));
  await user.click(screen.getByRole('button', { name: 'Send ↗' }));
  expect(send).toHaveBeenCalledWith('', {
    name: 'Statement · page 2',
    mediaType: 'image/jpeg',
    data: 'page2',
  });
});
