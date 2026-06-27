import type { ExamType } from "@/types";

export const examBlueprints: Record<
  ExamType,
  {
    title: string;
    minutes: number;
    focus: string;
    sections: string[];
  }
> = {
  TOEIC: {
    title: "TOEIC 職場情境測驗",
    minutes: 25,
    focus: "商務單字、Part 5 文法、Part 6/7 閱讀、職場聽力反應",
    sections: ["Part 5 Incomplete Sentences", "Part 6 Text Completion", "Part 7 Business Reading", "Listening Response"],
  },
  IELTS: {
    title: "IELTS 學術英文測驗",
    minutes: 30,
    focus: "Academic vocabulary、閱讀推論、段落功能、正式表達",
    sections: ["Academic Reading", "Vocabulary in Context", "Grammar Range", "Speaking/Writing Response"],
  },
  TOEFL: {
    title: "TOEFL 北美學術測驗",
    minutes: 30,
    focus: "Lecture gist、Reading inference、sentence function、校園對話",
    sections: ["Lecture Gist", "Reading Inference", "Vocabulary in Context", "Campus Conversation"],
  },
};

export function examSectionLabel(exam: ExamType, category: string, index: number) {
  const blueprint = examBlueprints[exam];
  if (!blueprint) return category;
  if (category === "listening") return blueprint.sections.at(-1) || "Listening";
  if (category === "reading") return blueprint.sections.find((s) => /Reading|Part 7|Inference/i.test(s)) || "Reading";
  if (category === "grammar") return blueprint.sections.find((s) => /Grammar|Part 5|Part 6/i.test(s)) || "Grammar";
  return blueprint.sections[index % blueprint.sections.length];
}
