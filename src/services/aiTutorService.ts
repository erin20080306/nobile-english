import type { Scene, TutorFeedback, DialogueResult } from "@/types";
import { mockAiTutorService } from "./mockAiTutorService";

// Facade over the AI tutor. Today it delegates to the local mock service so the
// app works with NO API key. To enable a real model later, implement a server
// route (e.g. /app/api/tutor/route.ts) that calls OpenAI with process.env.OPENAI_API_KEY
// and switch `USE_REMOTE` to true. The API key must stay on the server.

const USE_REMOTE = false;

export const aiTutorService = {
  isRemoteEnabled() {
    return USE_REMOTE;
  },

  async reply(scene: Scene, userInput: string, turn: number, history: string[] = []): Promise<{ en: string; zh: string }> {
    // if (USE_REMOTE) return fetch("/api/tutor", { ... })
    return mockAiTutorService.reply(scene, userInput, turn, history);
  },

  async feedback(scene: Scene, userInput: string, turn: number, history: string[] = []): Promise<TutorFeedback> {
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
