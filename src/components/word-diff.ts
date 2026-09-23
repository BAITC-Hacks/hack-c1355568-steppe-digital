/** Display-only LCS: never assigns an alignment status or changes the source string. */
export function wordDiff(before: string, after: string): { before: { text: string; changed: boolean }[]; after: { text: string; changed: boolean }[]; limited: boolean } {
  const b = before.match(/\s+|\S+/gu) ?? [], a = after.match(/\s+|\S+/gu) ?? [];
  if (b.length * a.length > 300_000) return { before: [{ text: before, changed: false }], after: [{ text: after, changed: false }], limited: true };
  const lengths = Array.from({ length: b.length + 1 }, () => new Uint32Array(a.length + 1));
  for (let i = b.length - 1; i >= 0; i--) for (let j = a.length - 1; j >= 0; j--) lengths[i][j] = b[i] === a[j] ? 1 + lengths[i + 1][j + 1] : Math.max(lengths[i + 1][j], lengths[i][j + 1]);
  const sameB = new Set<number>(), sameA = new Set<number>();
  let i = 0, j = 0;
  while (i < b.length && j < a.length) {
    if (b[i] === a[j]) { sameB.add(i++); sameA.add(j++); }
    else if (lengths[i + 1][j] >= lengths[i][j + 1]) i++; else j++;
  }
  return { before: b.map((text, i) => ({ text, changed: !sameB.has(i) })), after: a.map((text, i) => ({ text, changed: !sameA.has(i) })), limited: false };
}
