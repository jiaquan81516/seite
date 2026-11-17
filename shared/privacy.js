// Keep transaction dates readable while removing account/card/phone-like digit runs.
export function redactSensitiveText(text) {
  return String(text)
    .split(/(\b\d{4}-\d{2}-\d{2}\b)/g)
    .map((part, index) =>
      index % 2 ? part : part.replace(/\b(?:\d[ -]?){7,19}\b/g, '[number removed]'),
    )
    .join('');
}
