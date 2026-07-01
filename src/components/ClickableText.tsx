"use client";

import type { LearningLanguageCode } from "@/types";
import { dictionaryService } from "@/services/dictionaryService";

// Renders a sentence where language-aware tokens are tappable.
// onWord is called with the cleaned lookup token so a parent can open WordSheet.
export default function ClickableText({
  text,
  onWord,
  className = "",
  language = "en",
}: {
  text: string;
  onWord: (word: string) => void;
  className?: string;
  language?: LearningLanguageCode;
}) {
  const tokens = dictionaryService.tokenize(text, language);
  return (
    <span className={className}>
      {tokens.map((tok, i) => {
        if (!tok.lookup) return <span key={i}>{tok.text}</span>;
        return (
          <button
            key={i}
            onClick={(event) => {
              event.stopPropagation();
              onWord(tok.lookup!);
            }}
            className="underline decoration-dotted decoration-lilacDeep/50 underline-offset-4 hover:text-lilacDeep active:text-lilacDeep transition"
          >
            {tok.text}
          </button>
        );
      })}
    </span>
  );
}
