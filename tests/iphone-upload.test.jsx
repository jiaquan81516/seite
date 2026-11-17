import { beforeEach, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChatComposer } from '../src/components/chat/ChatComposer';
import { imageAttachment } from '../src/chat/attachments';
vi.mock('../src/chat/attachments', () => ({
  imageAttachment: vi.fn(),
  openPdf: vi.fn(),
  pdfPageAttachment: vi.fn(),
}));
beforeEach(() =>
  imageAttachment.mockResolvedValue({
    name: 'IMG_9359.HEIC',
    mediaType: 'image/jpeg',
    data: 'cHJvY2Vzc2Vk',
  }),
);
it('offers a photo-library/file picker and a separate rear-camera action', () => {
  render(<ChatComposer onSend={vi.fn()} enabled cloud busy={false} />);
  expect(screen.getByLabelText(/Photo or PDF/)).toHaveAttribute(
    'accept',
    'image/*,.heic,.heif,.heics,.heifs,application/pdf',
  );
  expect(screen.getByLabelText(/Photo or PDF/)).not.toHaveAttribute('capture');
  expect(screen.getByLabelText('Take photo')).toHaveAttribute('capture', 'environment');
  expect(screen.getByLabelText('Take photo')).toHaveAttribute('accept', 'image/*');
});
it('accepts a HEIC selection directly and sends only the prepared JPEG without an extra confirmation', async () => {
  const send = vi.fn().mockResolvedValue(true);
  const user = userEvent.setup();
  render(<ChatComposer onSend={send} enabled cloud busy={false} />);
  const file = new File(['heic-photo'], 'IMG_9359.HEIC', { type: 'image/heic' });
  await user.upload(screen.getByLabelText(/Photo or PDF/), file);
  await screen.findByAltText('Selected attachment');
  expect(imageAttachment).toHaveBeenCalledWith(file);
  expect(send).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: 'Send ↗' }));
  expect(send).toHaveBeenCalledWith('', {
    name: 'IMG_9359.HEIC',
    mediaType: 'image/jpeg',
    data: 'cHJvY2Vzc2Vk',
  });
});
