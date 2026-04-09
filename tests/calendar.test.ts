import { DateTime } from "luxon";
import { describe, expect, test } from "vitest";

import holidays from "../config/holidays-2026.json" with { type: "json" };
import { msUntilTarget, shouldSkipToday } from "../src/calendar.ts";

describe("shouldSkipToday", () => {
  test("skips weekends", () => {
    const saturday = DateTime.fromISO("2026-01-24T09:57:00", {
      zone: "America/Sao_Paulo"
    });

    expect(shouldSkipToday(saturday, holidays)).toBe("weekend");
  });

  test("skips holidays", () => {
    const holiday = DateTime.fromISO("2026-11-20T09:57:00", {
      zone: "America/Sao_Paulo"
    });

    expect(shouldSkipToday(holiday, holidays)).toBe("holiday");
  });

  test("does not skip regular weekdays", () => {
    const weekday = DateTime.fromISO("2026-04-08T09:57:00", {
      zone: "America/Sao_Paulo"
    });

    expect(shouldSkipToday(weekday, holidays)).toBeUndefined();
  });
});

describe("msUntilTarget", () => {
  test("waits until 10:00 for morning runs", () => {
    const morning = DateTime.fromISO("2026-04-08T09:57:00", {
      zone: "America/Sao_Paulo"
    });

    expect(msUntilTarget(morning)).toBe(180_000);
  });

  test("waits until 19:00 for evening runs", () => {
    const evening = DateTime.fromISO("2026-04-08T18:57:00", {
      zone: "America/Sao_Paulo"
    });

    expect(msUntilTarget(evening)).toBe(180_000);
  });

  test("returns 0 when past target time", () => {
    const late = DateTime.fromISO("2026-04-08T10:03:00", {
      zone: "America/Sao_Paulo"
    });

    expect(msUntilTarget(late)).toBe(0);
  });
});
