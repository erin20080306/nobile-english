const TAIPEI_TIME_ZONE = "Asia/Taipei";

export function getTaipeiDateString(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: TAIPEI_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const values: Record<string, string> = {};
  for (const part of parts) values[part.type] = part.value;
  return `${values.year}-${values.month}-${values.day}`;
}

export function getDayOfYearFromDateString(dateString: string): number {
  const [year, month, day] = dateString.split("-").map((value) => Number(value));
  const start = Date.UTC(year, 0, 1);
  const current = Date.UTC(year, month - 1, day);
  return Math.floor((current - start) / 86400000) + 1;
}

export function getDatedTopicKey(topicKey: string, dateString: string): string {
  return `${topicKey}_${dateString.replace(/-/g, "")}`;
}
