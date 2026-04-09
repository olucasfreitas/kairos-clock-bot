import { DateTime } from "luxon";

export const BRAZIL_TZ = "America/Sao_Paulo";
export type TargetSlot = "morning" | "evening";

export function shouldSkipToday(
  now: DateTime,
  holidays: readonly string[]
): string | undefined {
  if (now.weekday === 6 || now.weekday === 7) return "weekend";

  const date = now.toISODate();

  if (date && holidays.includes(date)) return "holiday";

  return undefined;
}

export function targetDateTime(now: DateTime, targetSlot: TargetSlot): DateTime {
  const hour = targetSlot === "morning" ? 10 : 19;

  return now.set({ hour, minute: 0, second: 0, millisecond: 0 });
}

export function msUntilTarget(now: DateTime, targetSlot: TargetSlot): number {
  const target = targetDateTime(now, targetSlot);

  return Math.max(0, Math.round(target.diff(now).as("milliseconds")));
}
