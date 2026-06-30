export const DAILY_READING_TIME_ZONE = "Asia/Taipei";

/**
 * Returns an ISO calendar date in the app's publishing time zone, not UTC.
 * `toISOString().slice(0, 10)` is wrong around Taiwan midnight.
 */
export function taipeiCalendarDate(date: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: DAILY_READING_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const byType = new Map(parts.map((part) => [part.type, part.value]));
  return `${byType.get("year")}-${byType.get("month")}-${byType.get("day")}`;
}

export function addTaipeiDays(days: number, from: Date = new Date()): string {
  const [year, month, day] = taipeiCalendarDate(from).split("-").map(Number);
  const localNoon = new Date(Date.UTC(year, month - 1, day + days, 12, 0, 0));
  return localNoon.toISOString().slice(0, 10);
}
