import type { ExamQuestion, ExamType, ExamResult } from "@/types";
import { examQuestions } from "@/data/examQuestions";
import { storageService, KEYS } from "./storageService";

export const examService = {
  getByExam(exam: ExamType): ExamQuestion[] {
    return examQuestions.filter((q) => q.exam === exam);
  },
  getQuestion(id: string): ExamQuestion | undefined {
    return examQuestions.find((q) => q.id === id);
  },
  countByExam(exam: ExamType) {
    const all = this.getByExam(exam);
    return {
      total: all.length,
      vocabulary: all.filter((q) => q.category === "vocabulary").length,
      grammar: all.filter((q) => q.category === "grammar").length,
      reading: all.filter((q) => q.category === "reading").length,
      listening: all.filter((q) => q.category === "listening").length,
    };
  },

  evaluate(exam: ExamType, questions: ExamQuestion[], answers: number[]): ExamResult {
    let correct = 0;
    const wrongIds: string[] = [];
    const reviewWords = new Set<string>();
    questions.forEach((q, i) => {
      if (answers[i] === q.answerIndex) correct++;
      else {
        wrongIds.push(q.id);
        (q.reviewWords || []).forEach((w) => reviewWords.add(w));
      }
    });
    const total = questions.length;
    const percent = Math.round((correct / total) * 100);
    let level = "需要加強";
    if (percent >= 85) level = "優秀 Excellent";
    else if (percent >= 70) level = "良好 Good";
    else if (percent >= 50) level = "及格 Pass";

    const result: ExamResult = {
      id: Math.random().toString(36).slice(2),
      exam,
      correct,
      total,
      percent,
      level,
      wrongQuestionIds: wrongIds,
      reviewWords: Array.from(reviewWords),
      completedAt: new Date().toISOString(),
    };
    // persist result + wrong questions
    const results = this.getResults();
    results.unshift(result);
    storageService.set(KEYS.examResults, results);

    const wrong = storageService.get<string[]>(KEYS.wrongQuestions, []);
    const mergedWrong = Array.from(new Set([...wrongIds, ...wrong]));
    storageService.set(KEYS.wrongQuestions, mergedWrong);

    return result;
  },

  getResults(): ExamResult[] {
    return storageService.get<ExamResult[]>(KEYS.examResults, []);
  },
  getWrongQuestions(): ExamQuestion[] {
    const ids = storageService.get<string[]>(KEYS.wrongQuestions, []);
    return ids.map((id) => this.getQuestion(id)).filter(Boolean) as ExamQuestion[];
  },
  clearWrong(id: string) {
    const ids = storageService.get<string[]>(KEYS.wrongQuestions, []).filter((x) => x !== id);
    storageService.set(KEYS.wrongQuestions, ids);
  },
};
