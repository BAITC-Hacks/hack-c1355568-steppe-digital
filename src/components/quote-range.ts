// Display-only normalization: never promotes an evidence verification status.
function normalized(value: string) {
  const chars: string[] = [];
  const starts: number[] = [];
  const ends: number[] = [];
  let offset = 0;
  for (const original of value) {
    const start = offset;
    offset += original.length;
    const char = /\s/u.test(original) ? " " : /[«»“”„]/u.test(original) ? '"' : /[‘’]/u.test(original) ? "'" : original.toLowerCase();
    if (char === " " && chars[chars.length - 1] === " ") { ends[ends.length - 1] = offset; continue; }
    for (const unit of char.split("")) { chars.push(unit); starts.push(start); ends.push(offset); }
  }
  return { text: chars.join(""), starts, ends };
}

export function quoteRange(fragment: string, quote: string): [number, number] | null {
  const source = normalized(fragment);
  const target = normalized(quote).text.trim();
  if (!target) return null;
  const at = source.text.indexOf(target);
  if (at < 0) return null;
  return [source.starts[at], source.ends[at + target.length - 1]];
}
