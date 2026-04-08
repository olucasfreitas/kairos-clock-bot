import { describe, expect, test } from "vitest";

async function loadIndexModule() {
  const indexModule = await import("../src/index.ts").catch(() => undefined);

  expect(indexModule).toBeDefined();

  return indexModule!;
}

describe("resolveRuntimeOptions", () => {
  test("maps the morning schedule to a clock-in run", async () => {
    const { resolveRuntimeOptions } = await loadIndexModule();

    const result = resolveRuntimeOptions({
      GITHUB_EVENT_NAME: "schedule",
      GITHUB_EVENT_SCHEDULE: "57 9 * * 1-5",
      KAIROS_EMAIL: "user@example.com",
      KAIROS_PASSWORD: "super-secret"
    });

    expect(result.action).toBe("clock-in");
    expect(result.dryRun).toBe(false);
    expect(result.enforceScheduleWindow).toBe(true);
  });

  test("maps the evening schedule to a clock-out run", async () => {
    const { resolveRuntimeOptions } = await loadIndexModule();

    const result = resolveRuntimeOptions({
      GITHUB_EVENT_NAME: "schedule",
      GITHUB_EVENT_SCHEDULE: "57 18 * * 1-5",
      KAIROS_EMAIL: "user@example.com",
      KAIROS_PASSWORD: "super-secret"
    });

    expect(result.action).toBe("clock-out");
    expect(result.dryRun).toBe(false);
    expect(result.enforceScheduleWindow).toBe(true);
  });

  test("lets workflow dispatch inputs override the defaults", async () => {
    const { resolveRuntimeOptions } = await loadIndexModule();

    const result = resolveRuntimeOptions({
      GITHUB_EVENT_NAME: "workflow_dispatch",
      INPUT_ACTION: "clock-out",
      INPUT_DRY_RUN: "true",
      KAIROS_EMAIL: "user@example.com",
      KAIROS_PASSWORD: "super-secret"
    });

    expect(result.action).toBe("clock-out");
    expect(result.dryRun).toBe(true);
    expect(result.enforceScheduleWindow).toBe(false);
  });

  test("throws when credentials are missing", async () => {
    const { resolveRuntimeOptions } = await loadIndexModule();

    expect(() =>
      resolveRuntimeOptions({
        GITHUB_EVENT_NAME: "workflow_dispatch",
        INPUT_ACTION: "clock-in"
      })
    ).toThrow(/KAIROS_EMAIL and KAIROS_PASSWORD/i);
  });
});
