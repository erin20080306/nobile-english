import type { Scene, TutorFeedback, DialogueResult, DialogueSuggestion } from "@/types";
import { mockAiTutorService } from "./mockAiTutorService";

// Facade over the AI tutor. The browser calls our Next.js API route; the route
// uses OpenAI when OPENAI_API_KEY exists, otherwise it falls back to local logic.
// The API key stays server-side and is never exposed to the client bundle.

const USE_REMOTE = true;

export const aiTutorService = {
  isRemoteEnabled() {
    return USE_REMOTE;
  },

  async reply(scene: Scene, userInput: string, turn: number, history: string[] = []): Promise<{ en: string; zh: string }> {
    const feedback = await this.feedback(scene, userInput, turn, history);
    return { en: feedback.reply, zh: feedback.replyZh };
  },

  async feedback(scene: Scene, userInput: string, turn: number, history: string[] = [], persona?: string): Promise<TutorFeedback> {
    if (USE_REMOTE && typeof window !== "undefined") {
      try {
        const res = await fetch("/api/tutor", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scene, userInput, turn, history, persona }),
        });
        if (res.ok) {
          const data = (await res.json()) as { feedback?: TutorFeedback };
          if (data.feedback) return data.feedback;
        }
      } catch {
        // Local fallback below keeps the practice usable offline.
      }
    }
    return mockAiTutorService.feedback(scene, userInput, turn, history);
  },

  // Summarize a finished dialogue into a score breakdown.
  summarize(scene: Scene, feedbacks: TutorFeedback[], userTurns: string[]): DialogueResult {
    const n = feedbacks.length;
    const naturalScores = feedbacks.map((f) => f.naturalness);
    const avgNatural = n > 0 ? Math.round(naturalScores.reduce((a, b) => a + b, 0) / n) : 70;

    // Trend bonus: if later turns are better than earlier ones, reward improvement
    const trendBonus = n >= 3
      ? Math.round((naturalScores.slice(-2).reduce((a, b) => a + b, 0) / 2) -
                   (naturalScores.slice(0, 2).reduce((a, b) => a + b, 0) / 2)) / 4
      : 0;

    // Grammar: based on how many turns had substantial grammar tips
    const grammarIssues = feedbacks.filter((f) => f.grammarTip && f.grammarTip.length > 5).length;
    const grammar = Math.min(99, Math.max(50, avgNatural + 5 - grammarIssues * 3));

    // Fluency: avg naturalness adjusted by turn count and trend
    const fluency = Math.min(99, Math.max(50, avgNatural + trendBonus));

    // Vocab: unique meaningful words in user turns
    const stopWords = new Set(["i","a","the","is","am","are","was","were","it","to","of","and","in","you","my","me","we","do","be","that","this","have","had","for","on","with","he","she","they","at","by","an","or","but"]);
    const allWords = userTurns.join(" ").toLowerCase().replace(/[^a-z\s]/g, "").split(/\s+/).filter(w => w.length > 2 && !stopWords.has(w));
    const uniqueWords = Array.from(new Set(allWords));
    const vocab = Math.min(99, Math.max(50, 55 + uniqueWords.length * 3 + userTurns.length * 2));

    // Task completion
    const expectedTurns = Math.max(1, scene.dialogue.filter(d => d.speaker === "user").length);
    const taskCompletion = Math.min(100, Math.round((userTurns.length / expectedTurns) * 100));

    const total = Math.min(99, Math.round((avgNatural * 0.35 + grammar * 0.25 + fluency * 0.25 + vocab * 0.15)));

    // Conversation words: meaningful unique words from user turns
    const conversationWords = uniqueWords.slice(0, 12);

    // Build specific suggestions from feedbacks
    const suggestions: DialogueSuggestion[] = [];
    const tipsSeen = new Set<string>();

    feedbacks.forEach((fb) => {
      if (fb.grammarTip && fb.grammarTip.length > 5 && !tipsSeen.has(fb.grammarTip)) {
        tipsSeen.add(fb.grammarTip);
        suggestions.push({
          area: "文法",
          tip: fb.grammarTip,
          example: fb.betterWay || undefined,
        });
      }
    });

    // Add score-based suggestions
    if (fluency < 70) suggestions.push({ area: "流暢度", tip: "試著用更完整的句子回答，避免單字回覆", example: "Instead of 'yes', try 'Yes, I'd love to!'" });
    if (vocab < 70) suggestions.push({ area: "單字量", tip: "嘗試使用場景關鍵單字：" + scene.keyWords.slice(0, 3).join(", ") });
    if (grammar < 70) suggestions.push({ area: "文法基礎", tip: "注意動詞時態，過去式加 -ed，現在式第三人稱加 -s" });
    if (total >= 80) suggestions.push({ area: "進階挑戰", tip: "嘗試更難的場景，或用更複雜的句型表達想法" });

    return {
      total,
      vocab,
      grammar,
      fluency,
      taskCompletion,
      reviewSentences: scene.keyPatterns.map((p) => p.en).slice(0, 3),
      newWords: scene.keyWords.slice(0, 5),
      conversationWords,
      suggestions: suggestions.slice(0, 4),
      nextSceneId: undefined,
    };
  },
};
