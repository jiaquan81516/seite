import { jsonSchema } from 'ai';
import { z } from 'zod';
import { aiReplySchema } from '../../shared/ai-schema.js';

const VALUE_CONSTRAINTS = new Set([
  'minLength',
  'maxLength',
  'minItems',
  'maxItems',
  'minimum',
  'maximum',
  'exclusiveMinimum',
  'exclusiveMaximum',
  'multipleOf',
  'pattern',
  'format',
]);

function simplifyForGeneration(node) {
  if (Array.isArray(node)) return node.map(simplifyForGeneration);
  if (!node || typeof node !== 'object') return node;
  return Object.fromEntries(
    Object.entries(node)
      .filter(([key]) => !VALUE_CONSTRAINTS.has(key))
      .map(([key, value]) => [key, simplifyForGeneration(value)]),
  );
}

// Gemini's decoder rejects the full bounded schema as "too many states".
// Keep shape, required fields, nullability and enums on the wire. Enforce all
// value/length/count constraints locally before an output can reach the UI.
export const geminiGenerationSchema = simplifyForGeneration(
  z.toJSONSchema(aiReplySchema),
);
export const geminiOutputSchema = jsonSchema(geminiGenerationSchema, {
  validate(value) {
    const result = aiReplySchema.safeParse(value);
    return result.success
      ? { success: true, value: result.data }
      : { success: false, error: result.error };
  },
});
