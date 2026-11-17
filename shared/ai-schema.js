import { z } from 'zod';
import { CATEGORIES, PAYMENT_METHODS } from '../src/lib/config.js';

export const entryChangesSchema = z
  .object({
    merchant: z.string().trim().min(1).max(160).nullable(),
    amount_cents: z.number().int().positive().max(Number.MAX_SAFE_INTEGER).nullable(),
    date: z.string().max(10).nullable(),
    time: z.string().max(5).nullable(),
    category: z.enum(CATEGORIES).nullable(),
    method: z.enum(PAYMENT_METHODS).nullable(),
    note: z.string().max(2000).nullable(),
  })
  .strict();

// A bulk request describes WHICH entries to remove; it never lists IDs. The app
// resolves the filter against saved entries, so the model cannot pick records.
export const bulkFilterSchema = z
  .object({
    category: z.enum(CATEGORIES).nullable(),
    method: z.enum(PAYMENT_METHODS).nullable(),
    merchant: z.string().trim().max(160).nullable(),
    date_from: z.string().max(10).nullable(),
    date_to: z.string().max(10).nullable(),
  })
  .strict();

export function hasBulkCriteria(filter) {
  return Boolean(
    filter &&
    (filter.category ||
      filter.method ||
      filter.merchant?.trim() ||
      filter.date_from ||
      filter.date_to),
  );
}

export const entryActionSchema = z
  .object({
    type: z.enum(['delete', 'update', 'bulk_delete']),
    target_id: z.string().max(160).nullable(),
    changes: entryChangesSchema.nullable(),
    filter: bulkFilterSchema.nullable().optional(),
  })
  .strict();

export const candidateSchema = z.object({
  merchant: z.string().max(160).nullable(),
  amount: z.number().finite().nonnegative().nullable(),
  currency: z
    .string()
    .regex(/^[A-Z]{3}$/)
    .nullable(),
  date: z.string().nullable(),
  time: z.string().nullable(),
  payment_method: z.string().max(80).nullable(),
  category: z.enum(CATEGORIES).nullable(),
  confidence: z.number().min(0).max(1),
  notes: z.string().max(1200),
  kind: z.enum(['expense', 'refund', 'income', 'paylater', 'transfer', 'unknown']),
  needs_personal_share: z.boolean(),
});

export const aiReplySchema = z.object({
  kind: z.enum(['extraction', 'answer', 'help', 'clarification', 'correction', 'action']),
  reply: z.string().max(2000),
  transactions: z.array(candidateSchema).max(30),
  answer_fact_id: z.string().max(150).nullable(),
  correction: z
    .object({ target_id: z.string().max(160), category: z.enum(CATEGORIES) })
    .nullable(),
  action: entryActionSchema.nullable().optional(),
});

const imageSchema = z.object({
  mediaType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
  data: z
    .string()
    .max(5_600_000)
    .regex(/^[A-Za-z0-9+/]+={0,2}$/),
});

export const chatRequestSchema = z.object({
  text: z.string().max(2000),
  mode: z.enum(['cloud', 'local']),
  sensitive: z.boolean(),
  cloudConsent: z.boolean(),
  allowFallback: z.boolean(),
  image: imageSchema.nullable(),
  history: z
    .array(z.object({ role: z.enum(['user', 'assistant']), text: z.string().max(4000) }))
    .max(6),
  context: z.object({
    today: z.string().max(10),
    facts: z
      .array(z.object({ id: z.string().max(150), text: z.string().max(500) }))
      .max(100),
    recent: z
      .array(
        z.object({
          id: z.string().max(160),
          merchant: z.string().max(160),
          date: z.string().max(10),
          amount_cents: z.number().int().nonnegative(),
          category: z.enum(CATEGORIES),
        }),
      )
      .max(12),
    candidates: z
      .array(
        z.object({
          id: z.string().max(160),
          merchant: z.string().max(160).nullable(),
          category: z.enum(CATEGORIES).nullable(),
          amount: z.number().nullable(),
          currency: z.string().nullable(),
          date: z.string().nullable(),
        }),
      )
      .max(30),
  }),
});
