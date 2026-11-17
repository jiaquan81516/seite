import { describe, expect, it } from 'vitest';
import {
  geminiGenerationSchema,
  geminiOutputSchema,
} from '../../server/ai/output-schema';
import { aiReply } from '../ai-fixtures';

describe('Gemini generation schema', () => {
  it('keeps the response shape without decoder-expensive bounded constraints', () => {
    const schema = JSON.stringify(geminiGenerationSchema);
    for (const constraint of ['maxLength', 'maxItems', 'minimum', 'maximum', 'pattern']) {
      expect(schema).not.toContain(`"${constraint}"`);
    }
    expect(geminiGenerationSchema.required).toContain('transactions');
    expect(schema).toContain('Food & Drink');
    expect(schema).toContain('needs_personal_share');
  });
  it('still rejects out-of-range confidence and oversized transaction batches locally', () => {
    const valid = aiReply();
    expect(geminiOutputSchema.validate(valid).success).toBe(true);
    expect(
      geminiOutputSchema.validate(
        aiReply({ transactions: [{ ...valid.transactions[0], confidence: 2 }] }),
      ).success,
    ).toBe(false);
    expect(
      geminiOutputSchema.validate(
        aiReply({ transactions: Array(31).fill(valid.transactions[0]) }),
      ).success,
    ).toBe(false);
  });
  it('still rejects prose amounts and unreadable currency strings', () => {
    const valid = aiReply();
    expect(
      geminiOutputSchema.validate(
        aiReply({
          transactions: [{ ...valid.transactions[0], amount: 'three dollars' }],
        }),
      ).success,
    ).toBe(false);
    expect(
      geminiOutputSchema.validate(
        aiReply({
          transactions: [{ ...valid.transactions[0], currency: 'Singapore dollars' }],
        }),
      ).success,
    ).toBe(false);
  });
});
