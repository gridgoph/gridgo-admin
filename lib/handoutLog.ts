import type { Handout, StaffTotal } from "@/lib/api";

/**
 * The handover log, as rules: grouping by day, today's count, totals.
 * Dates are the phone's local day, which at the hub is the hub's day.
 */

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

export function dayTitle(at: string, now: Date = new Date()): string {
  const date = new Date(at);
  if (dayKey(date) === dayKey(now)) return "Today";
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (dayKey(date) === dayKey(yesterday)) return "Yesterday";
  return date.toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" });
}

export function timeLabel(at: string): string {
  return new Date(at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export type HandoutSection = { title: string; data: Handout[] };

/** Newest first, one section per day. Input order is the API's (newest first). */
export function groupByDay(handouts: readonly Handout[], now: Date = new Date()): HandoutSection[] {
  const sections: HandoutSection[] = [];
  for (const handout of handouts) {
    const title = dayTitle(handout.at, now);
    const last = sections.at(-1);
    if (last?.title === title) last.data.push(handout);
    else sections.push({ title, data: [handout] });
  }
  return sections;
}

/** Handovers among the loaded rows that happened today. */
export function countToday(handouts: readonly Handout[], now: Date = new Date()): number {
  const today = dayKey(now);
  return handouts.filter((handout) => dayKey(new Date(handout.at)) === today).length;
}

/** The caller's own total from the API's totals (covers every page). */
export function ownTotal(totals: readonly StaffTotal[] | null | undefined, staffId: string | null): number {
  if (!totals) return 0;
  if (staffId) return totals.find((total) => total.staffId === staffId)?.count ?? 0;
  return totals.reduce((sum, total) => sum + total.count, 0);
}

/** Busiest first; ties by name so the order is stable between refreshes. */
export function rankTotals(totals: readonly StaffTotal[]): StaffTotal[] {
  return [...totals].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}
