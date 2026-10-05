import type { HubSchedule } from "@/lib/api";

/**
 * Today at the hub, in the hub's own time zone.
 *
 * The schedule's minutes are local to `utcOffsetMinutes` (UTC+08:00 for the
 * pilot), so "today" is computed there rather than in the phone's zone.
 */
export type HubToday =
  | { kind: "open"; dayKey: string; label: string }
  | { kind: "closed"; dayKey: string; reason: "closure" | "not_a_hub_day" };

function clock(minuteOfDay: number): string {
  const hours24 = Math.floor(minuteOfDay / 60);
  const minutes = minuteOfDay % 60;
  const suffix = hours24 >= 12 ? "PM" : "AM";
  const hours = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return `${hours}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

/** `YYYY-MM-DD` of `now` in the hub's zone. */
export function hubDayKey(now: Date, utcOffsetMinutes: number): string {
  return new Date(now.getTime() + utcOffsetMinutes * 60000).toISOString().slice(0, 10);
}

export function hubToday(schedule: HubSchedule, now: Date = new Date()): HubToday {
  const local = new Date(now.getTime() + schedule.utcOffsetMinutes * 60000);
  const dayKey = local.toISOString().slice(0, 10);
  if ((schedule.closures ?? []).some((c) => dayKey >= c.startDay && dayKey <= c.endDay)) {
    return { kind: "closed", dayKey, reason: "closure" };
  }
  const windows = schedule.week
    .filter((window) => window.weekday === local.getUTCDay())
    .sort((a, b) => a.opensMinute - b.opensMinute);
  if (!windows.length) return { kind: "closed", dayKey, reason: "not_a_hub_day" };
  const label = windows
    .map((window) => `${clock(window.opensMinute)} – ${clock(window.closesMinute)}`)
    .join(", ");
  return { kind: "open", dayKey, label };
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** "Mon, Wed, Fri" — the hub days, in week order. */
export function hubDaysLabel(schedule: HubSchedule): string {
  const days = [...new Set(schedule.week.map((window) => window.weekday))].sort();
  return days.map((day) => WEEKDAYS[day]).join(", ");
}
