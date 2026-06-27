"use client";

// Renders an English sentence where each word is tappable.
// onWord is called with the cleaned word so a parent can open WordSheet.
export default function ClickableText({
  text,
  onWord,
  className = "",
}: {
  text: string;
  onWord: (word: string) => void;
  className?: string;
}) {
  const tokens = text.split(/(\s+)/);
  return (
    <span className={className}>
      {tokens.map((tok, i) => {
        if (/^\s+$/.test(tok)) return <span key={i}>{tok}</span>;
        const clean = tok.replace(/[^A-Za-z'-]/g, "");
        if (!clean) return <span key={i}>{tok}</span>;
        const lead = tok.slice(0, tok.indexOf(clean));
        const trail = tok.slice(tok.indexOf(clean) + clean.length);
        return (
          <span key={i}>
            {lead}
            <button
              onClick={() => onWord(clean)}
              className="underline decoration-dotted decoration-lilacDeep/50 underline-offset-4 hover:text-lilacDeep active:text-lilacDeep transition"
            >
              {clean}
            </button>
            {trail}
          </span>
        );
      })}
    </span>
  );
}
