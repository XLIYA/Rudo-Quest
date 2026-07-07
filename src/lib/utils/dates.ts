import {
  addDays,
  differenceInCalendarDays,
  format,
  isAfter,
  parseISO,
  startOfWeek,
} from "date-fns";

/**
 * Purpose: Normalize any date into the Monday that starts its week.
 * Inputs: A Date object interpreted in the runtime timezone.
 * Output: ISO yyyy-MM-dd string for week start.
 * Side effects: None.
 * Business rule: Rudo Quest weeks always start on Monday.
 */
export function getMondayWeekStart(date: Date): string {
  return format(startOfWeek(date, { weekStartsOn: 1 }), "yyyy-MM-dd");
}

/**
 * Purpose: Build the seven ISO dates that belong to a Rudo Quest week.
 * Inputs: ISO yyyy-MM-dd week-start string.
 * Output: Seven ISO yyyy-MM-dd strings from Monday through Sunday.
 * Side effects: None.
 */
export function getWeekDates(weekStart: string): string[] {
  const start = parseISO(weekStart);
  return Array.from({ length: 7 }, (_, index) => format(addDays(start, index), "yyyy-MM-dd"));
}

/**
 * Purpose: Validate an IANA timezone name using the platform Intl implementation.
 * Inputs: Candidate timezone text.
 * Output: True when Intl can construct a formatter for the timezone.
 * Side effects: None.
 */
export function isValidTimeZone(timeZone: string): boolean {
  try {
    Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

/**
 * Purpose: Calculate the current completion streak from a daily completion series.
 * Inputs: Day/count pairs sorted or unsorted.
 * Output: Number of consecutive days ending today or yesterday with at least one completion.
 * Side effects: None.
 */
export function calculateCompletionStreak(days: { date: string; count: number }[]): number {
  const byDate = new Map(days.map((day) => [day.date, day.count]));
  let cursor = new Date();
  if ((byDate.get(format(cursor, "yyyy-MM-dd")) ?? 0) === 0) {
    cursor = addDays(cursor, -1);
  }
  let streak = 0;
  for (;;) {
    const key = format(cursor, "yyyy-MM-dd");
    if ((byDate.get(key) ?? 0) <= 0) {
      return streak;
    }
    streak += 1;
    cursor = addDays(cursor, -1);
  }
}

/**
 * Purpose: Produce a compact human label for an ISO timestamp.
 * Inputs: ISO timestamp.
 * Output: Relative day label suitable for activity and notifications.
 * Side effects: None.
 */
export function formatRelativeDay(value: string): string {
  const days = differenceInCalendarDays(new Date(), parseISO(value));
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days > 1 && days < 7) return `${days} days ago`;
  return format(parseISO(value), "MMM d, yyyy");
}

/**
 * Purpose: Determine if an ISO date is before today.
 * Inputs: ISO yyyy-MM-dd date.
 * Output: True when the date is overdue.
 * Side effects: None.
 */
export function isPastDate(value: string): boolean {
  return isAfter(startOfWeek(new Date(), { weekStartsOn: 1 }), parseISO(value));
}
