import type { Scene, TutorFeedback, DialogueResult } from "@/types";
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

  async feedback(scene: Scene, userInput: string, turn: number, history: string[] = []): Promise<TutorFeedback> {
    if (USE_REMOTE && typeof window !== "undefined") {
      try {
        const res = await fetch("/api/tutor", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scene, userInput, turn, history }),
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
    const avgNatural =
      feedbacks.length > 0
        ? Math.round(feedbacks.reduce((a, f) => a + f.naturalness, 0) / feedbacks.length)
        : 70;
    const grammar = Math.min(99, avgNatural + 2);
    const fluency = Math.min(99, Math.max(50, avgNatural - 3));
    const vocab = Math.min(99, 60 + userTurns.length * 5);
    const taskCompletion = Math.min(100, Math.round((userTurns.length / Math.max(1, scene.dialogue.filter(d => d.speaker === "user").length)) * 100));
    const total = Math.round((avgNatural + grammar + fluency + vocab) / 4);

    return {
      total,
      vocab,
      grammar,
      fluency,
      taskCompletion,
      reviewSentences: scene.keyPatterns.map((p) => p.en).slice(0, 3),
      newWords: scene.keyWords.slice(0, 5),
      nextSceneId: undefined,
    };
  },
};
