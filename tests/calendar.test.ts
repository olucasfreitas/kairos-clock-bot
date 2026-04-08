import { DateTime } from "luxon";
import { describe, expect, test } from "vitest";

import holidays2026 from "../config/holidays-2026.json" with { type: "json" };

async function loadCalendarModule() {
  const calendarModule = await import("../src/calendar.ts").catch(() => undefined);

  expect(calendarModule).toBeDefined();

  return calendarModule!;
}

describe("buildPunchDecision", () => {
  test("skips weekends in Sao Paulo time", async () => {
    const { buildPunchDecision } = await loadCalendarModule();

    const result = buildPunchDecision({
      action: "clock-in",
      holidays: holidays2026,
      now: DateTime.fromISO("2026-01-24T09:57:00", {
        zone: "America/Sao_Paulo"
      })
    });

    expect(result.shouldSkip).toBe(true);
    expect(result.skipReason).toBe("weekend");
    expect(result.localDate).toBe("2026-01-24");
  });

  test("skips configured holidays even on weekdays", async () => {
    const { buildPunchDecision } = await loadCalendarModule();

    const result = buildPunchDecision({
      action: "clock-out",
      holidays: holidays2026,
      now: DateTime.fromISO("2026-11-20T18:57:00", {
        zone: "America/Sao_Paulo"
      })
    });

    expect(result.shouldSkip).toBe(true);
    expect(result.skipReason).toBe("holiday");
    expect(result.localDate).toBe("2026-11-20");
  });

  test("waits until 10am BRT for clock-in runs", async () => {
    const { buildPunchDecision } = await loadCalendarModule();

    const result = buildPunchDecision({
      action: "clock-in",
      holidays: holidays2026,
      now: DateTime.fromISO("2026-04-08T09:57:00", {
        zone: "America/Sao_Paulo"
      })
    });

    expect(result.shouldSkip).toBe(false);
    expect(result.targetIso).toBe("2026-04-08T10:00:00.000-03:00");
    expect(result.waitMs).toBe(180000);
  });

  test("does not wait when the runner starts a few minutes after the target time", async () => {
    const { buildPunchDecision } = await loadCalendarModule();

    const result = buildPunchDecision({
      action: "clock-in",
      holidays: holidays2026,
      now: DateTime.fromISO("2026-04-08T10:03:30", {
        zone: "America/Sao_Paulo"
      })
    });

    expect(result.shouldSkip).toBe(false);
    expect(result.targetIso).toBe("2026-04-08T10:00:00.000-03:00");
    expect(result.waitMs).toBe(0);
  });

  test("skips a run that starts too late", async () => {
    const { buildPunchDecision } = await loadCalendarModule();

    const result = buildPunchDecision({
      action: "clock-in",
      holidays: holidays2026,
      now: DateTime.fromISO("2026-04-08T10:07:00", {
        zone: "America/Sao_Paulo"
      })
    });

    expect(result.shouldSkip).toBe(true);
    expect(result.skipReason).toBe("missed-window");
    expect(result.waitMs).toBe(0);
  });

  test("allows a late manual retry when lateness enforcement is disabled", async () => {
    const { buildPunchDecision } = await loadCalendarModule();

    const result = buildPunchDecision({
      action: "clock-in",
      holidays: holidays2026,
      now: DateTime.fromISO("2026-04-08T10:07:00", {
        zone: "America/Sao_Paulo"
      }),
      enforceLatenessWindow: false
    });

    expect(result.shouldSkip).toBe(false);
    expect(result.waitMs).toBe(0);
  });

  test("targets 7pm BRT for clock-out runs", async () => {
    const { buildPunchDecision } = await loadCalendarModule();

    const result = buildPunchDecision({
      action: "clock-out",
      holidays: holidays2026,
      now: DateTime.fromISO("2026-04-08T18:57:00", {
        zone: "America/Sao_Paulo"
      })
    });

    expect(result.shouldSkip).toBe(false);
    expect(result.targetIso).toBe("2026-04-08T19:00:00.000-03:00");
    expect(result.waitMs).toBe(180000);
  });
});
