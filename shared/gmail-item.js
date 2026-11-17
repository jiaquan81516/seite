import { z } from 'zod';
import { CATEGORIES, PAYMENT_METHODS } from '../src/lib/config.js';

// One parsed email from the Gmail sync script. The script is trusted to be the
// user's own, but its output is still validated like any other input.
export const gmailItemSchema = z.object({
  id: z.string().regex(/^[A-Za-z0-9]{6,64}$/),
  merchant: z.string().trim().min(1).max(160),
  amount: z.number().positive().max(10_000_000),
  currency: z.string().regex(/^[A-Z]{3}$/),
  date: z.string().max(10),
  time: z.string().max(5),
  payment_method: z.enum(PAYMENT_METHODS).nullable(),
  category: z.enum(CATEGORIES),
  kind: z.enum(['expense', 'refund', 'income', 'paylater', 'transfer', 'unknown']),
  confidence: z.number().min(0).max(1),
  received_at: z.string().max(40),
});

export const gmailReplySchema = z.object({
  ok: z.boolean(),
  error: z.string().max(100).optional(),
  pending: z.number().int().nonnegative().optional(),
  items: z.array(z.unknown()).max(50).optional(),
  remaining: z.number().int().nonnegative().optional(),
  last_sync: z.string().max(40).nullable().optional(),
});
