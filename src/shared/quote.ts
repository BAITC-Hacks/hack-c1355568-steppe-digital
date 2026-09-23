/** Matching only: retain the original strings for evidence display. */
export function normalizeQuote(value: string): string {
  return value.normalize("NFC").replace(/[«»“”„‟]/gu, '"').replace(/[‘’‚‛]/gu, "'")
    .replace(/\s+/gu, " ").trim().toLocaleLowerCase("ru");
}

export function validateQuote(fragmentText: string, quote: string): boolean {
  const normalized = normalizeQuote(quote);
  return normalized.length > 0 && normalizeQuote(fragmentText).includes(normalized);
}
