import { DateTime } from "luxon";

export const BRAZIL_TIMEZONE = "America/Sao_Paulo";
export const MAX_ALLOWED_LATENESS_MS = 5 * 60 * 1000;

export type PunchAction = "clock-in" | "clock-out";
export type SkipReason = "holiday" | "missed-window" | "weekend";

export interface PunchDecision {
  action: PunchAction;
  localDate: string;
  shouldSkip: boolean;
  skipReason?: SkipReason;
  targetIso: string;
  waitMs: number;
  zone: string;
}

interface BuildPunchDecisionParams {
  action: PunchAction;
  enforceLatenessWindow?: boolean;
  holidays: readonly string[];
  now: DateTime;
  zone?: string;
}

const TARGET_TIMES: Record<PunchAction, { hour: number; minute: number }> = {
  "clock-in": { hour: 10, minute: 0 },
  "clock-out": { hour: 19, minute: 0 }
};

export function buildPunchDecision({
  action,
  enforceLatenessWindow = true,
  holidays,
  now,
  zone = BRAZIL_TIMEZONE
}: BuildPunchDecisionParams): PunchDecision {
  const localNow = now.setZone(zone);
  const localDate = localNow.toISODate();
  const targetTime = TARGET_TIMES[action];
  const targetDateTime = localNow.startOf("day").set({
    hour: targetTime.hour,
    minute: targetTime.minute,
    second: 0,
    millisecond: 0
  });

  if (!localDate) {
    throw new Error("Unable to determine the local date.");
  }

  const weekend = localNow.weekday === 6 || localNow.weekday === 7;
  const holiday = holidays.includes(localDate);
  const latenessMs = Math.max(
    0,
    Math.round(localNow.diff(targetDateTime).as("milliseconds"))
  );

  if (weekend) {
    return createDecision({
      action,
      localDate,
      shouldSkip: true,
      skipReason: "weekend",
      targetDateTime,
      waitMs: 0,
      zone
    });
  }

  if (holiday) {
    return createDecision({
      action,
      localDate,
      shouldSkip: true,
      skipReason: "holiday",
      targetDateTime,
      waitMs: 0,
      zone
    });
  }

  if (enforceLatenessWindow && latenessMs > MAX_ALLOWED_LATENESS_MS) {
    return createDecision({
      action,
      localDate,
      shouldSkip: true,
      skipReason: "missed-window",
      targetDateTime,
      waitMs: 0,
      zone
    });
  }

  return createDecision({
    action,
    localDate,
    shouldSkip: false,
    targetDateTime,
    waitMs: Math.max(0, Math.round(targetDateTime.diff(localNow).as("milliseconds"))),
    zone
  });
}

function createDecision({
  action,
  localDate,
  shouldSkip,
  skipReason,
  targetDateTime,
  waitMs,
  zone
}: {
  action: PunchAction;
  localDate: string;
  shouldSkip: boolean;
  skipReason?: SkipReason;
  targetDateTime: DateTime;
  waitMs: number;
  zone: string;
}): PunchDecision {
  const targetIso = targetDateTime.toISO();

  if (!targetIso) {
    throw new Error("Unable to determine the target timestamp.");
  }

  return {
    action,
    localDate,
    shouldSkip,
    skipReason,
    targetIso,
    waitMs,
    zone
  };
}
