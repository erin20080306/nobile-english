import type { CEFRLevel } from "@/types";

export interface DailyReadingTopic {
  key: string;
  titleZhTw: string;
  category: string;
}

export const DAILY_READING_TOPICS: DailyReadingTopic[] = [
  { key: "ordering_coffee", titleZhTw: "在咖啡店點餐", category: "daily_life" },
  { key: "first_meeting", titleZhTw: "第一次參加公司會議", category: "work" },
  { key: "weekend_trip", titleZhTw: "週末旅行計畫", category: "travel" },
  { key: "supermarket", titleZhTw: "超市購物", category: "daily_life" },
  { key: "birthday_party", titleZhTw: "朋友生日聚會", category: "social" },
  { key: "weather_clothing", titleZhTw: "天氣與穿搭", category: "daily_life" },
  { key: "taking_leave", titleZhTw: "工作請假", category: "work" },
  { key: "healthy_habits", titleZhTw: "健康生活習慣", category: "health" },
  { key: "hotel_checkin", titleZhTw: "飯店入住", category: "travel" },
  { key: "online_shopping", titleZhTw: "線上購物", category: "daily_life" },
  { key: "job_interview", titleZhTw: "面試準備", category: "work" },
  { key: "daily_commute", titleZhTw: "日常通勤", category: "daily_life" },
];

export const DAILY_READING_DIFFICULTIES: CEFRLevel[] = ["A1", "A2", "B1"];

export function pickDailyReadingPlan(publishDate: string) {
  const day = Number(publishDate.slice(-2)) || new Date().getDate();
  return {
    topic: DAILY_READING_TOPICS[day % DAILY_READING_TOPICS.length],
    difficultyLevel: DAILY_READING_DIFFICULTIES[day % DAILY_READING_DIFFICULTIES.length],
  };
}
