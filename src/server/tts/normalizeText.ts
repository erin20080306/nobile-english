// Text normalization used before hashing/synthesis. Must NOT change the meaning
// of any language. Safe for ja/ko/es/it (no character splitting).

export function normalizeText(input: string): string {
  if (!input) return "";
  let text = input.normalize("NFC");

  // Normalize all line breaks, then collapse 3+ blank lines into a single paragraph break.
  text = text.replace(/\r\n?/g, "\n");
  text = text.replace(/[ \t\f\v]+/g, " "); // collapse horizontal whitespace only
  text = text.replace(/ *\n */g, "\n"); // trim spaces around line breaks
  text = text.replace(/\n{3,}/g, "\n\n"); // at most one blank line

  // Unify common full/half-width punctuation spacing without altering the characters.
  text = text.replace(/ +([,.;:!?，。；：！？])/g, "$1");

  return text.trim();
}

// Combine the tutor's two reply parts into ONE text block, so a single audio
// file is produced. The frontend may still display the two parts separately.
export function combineTutorText(part1: string, part2?: string): string {
  const a = normalizeText(part1);
  const b = part2 ? normalizeText(part2) : "";
  if (a && b) return `${a}\n\n${b}`;
  return a || b;
}
