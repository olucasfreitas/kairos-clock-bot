import { DateTime } from "luxon";

export const BRAZIL_TZ = "America/Sao_Paulo";

export function shouldSkipToday(
  now: DateTime,
  holidays: readonly string[]
): string | undefined {
  if (now.weekday === 6 || now.weekday === 7) return "weekend";

  const date = now.toISODate();

  if (date && holidays.includes(date)) return "holiday";

  return undefined;
}

export function msUntilTarget(now: DateTime): number {
  const hour = now.hour < 14 ? 10 : 19;
  const target = now.set({ hour, minute: 0, second: 0, millisecond: 0 });

  return Math.max(0, Math.round(target.diff(now).as("milliseconds")));
}
