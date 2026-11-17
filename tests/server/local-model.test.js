import { describe, expect, it, vi } from 'vitest';
import { verifyLocalModel } from '../../server/ai/local-model';
describe('local model verification', () => {
  it('allows installed model weights', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ models: [{ name: 'gemma3:4b', size: 3000000000 }] }),
        ),
      );
    await expect(
      verifyLocalModel('gemma3:4b', undefined, fetch),
    ).resolves.toBeUndefined();
  });
  it('rejects cloud-proxied models without passing any content', async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          models: [
            {
              name: 'alias:latest',
              size: 100,
              remote_host: 'https://ollama.com',
              remote_model: 'remote',
            },
          ],
        }),
      ),
    );
    await expect(verifyLocalModel('alias', undefined, fetch)).rejects.toThrow(
      /local model weights/,
    );
    expect(fetch).toHaveBeenCalledWith('http://127.0.0.1:11434/api/tags', {
      signal: undefined,
    });
  });
});
