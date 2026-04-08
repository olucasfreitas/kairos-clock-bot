import { describe, expect, test } from "vitest";

async function loadIndexModule() {
  const indexModule = await import("../src/index.ts").catch(() => undefined);

  expect(indexModule).toBeDefined();

  return indexModule!;
}

describe("resolveRuntimeOptions", () => {
  test("maps the morning schedule to a clock-in run", async () => {
    const { resolveRuntimeOptions } = await loadIndexModule();

    const result = resolveRuntimeOptions(
      ["--action", "clock-in", "--execution-mode", "schedule"],
      {
      GITHUB_EVENT_NAME: "schedule",
      KAIROS_EMAIL: "user@example.com",
      KAIROS_PASSWORD: "super-secret"
      }
    );

    expect(result.action).toBe("clock-in");
    expect(result.dryRun).toBe(false);
    expect(result.enforceScheduleWindow).toBe(true);
  });

  test("maps the evening schedule to a clock-out run", async () => {
    const { resolveRuntimeOptions } = await loadIndexModule();

    const result = resolveRuntimeOptions(
      ["--action", "clock-out", "--execution-mode", "schedule"],
      {
      GITHUB_EVENT_NAME: "schedule",
      KAIROS_EMAIL: "user@example.com",
      KAIROS_PASSWORD: "super-secret"
      }
    );

    expect(result.action).toBe("clock-out");
    expect(result.dryRun).toBe(false);
    expect(result.enforceScheduleWindow).toBe(true);
  });

  test("lets explicit CLI flags control a manual dry-run", async () => {
    const { resolveRuntimeOptions } = await loadIndexModule();

    const result = resolveRuntimeOptions(
      ["--action", "clock-out", "--execution-mode", "manual", "--dry-run"],
      {
      GITHUB_EVENT_NAME: "workflow_dispatch",
      KAIROS_EMAIL: "user@example.com",
      KAIROS_PASSWORD: "super-secret"
      }
    );

    expect(result.action).toBe("clock-out");
    expect(result.dryRun).toBe(true);
    expect(result.enforceScheduleWindow).toBe(false);
  });

  test("rejects live workflow dispatch runs unless explicitly forced", async () => {
    const { resolveRuntimeOptions } = await loadIndexModule();

    expect(() =>
      resolveRuntimeOptions(
        ["--action", "clock-in", "--execution-mode", "manual"],
        {
        GITHUB_EVENT_NAME: "workflow_dispatch",
        KAIROS_EMAIL: "user@example.com",
        KAIROS_PASSWORD: "super-secret"
        }
      )
    ).toThrow(/force-live/i);
  });

  test("allows live workflow dispatch runs when force_live is true", async () => {
    const { resolveRuntimeOptions } = await loadIndexModule();

    const result = resolveRuntimeOptions(
      ["--action", "clock-in", "--execution-mode", "manual", "--force-live"],
      {
      GITHUB_EVENT_NAME: "workflow_dispatch",
      KAIROS_EMAIL: "user@example.com",
      KAIROS_PASSWORD: "super-secret"
      }
    );

    expect(result.action).toBe("clock-in");
    expect(result.dryRun).toBe(false);
  });

  test("rejects reruns of live attempts", async () => {
    const { resolveRuntimeOptions } = await loadIndexModule();

    expect(() =>
      resolveRuntimeOptions(
        ["--action", "clock-in", "--execution-mode", "schedule"],
        {
        GITHUB_EVENT_NAME: "schedule",
        GITHUB_RUN_ATTEMPT: "2",
        KAIROS_EMAIL: "user@example.com",
        KAIROS_PASSWORD: "super-secret"
        }
      )
    ).toThrow(/rerun/i);
  });

  test("requires the action flag explicitly", async () => {
    const { resolveRuntimeOptions } = await loadIndexModule();

    expect(() =>
      resolveRuntimeOptions([], {
        KAIROS_EMAIL: "user@example.com",
        KAIROS_PASSWORD: "super-secret"
      })
    ).toThrow(/action/i);
  });

  test("throws when credentials are missing", async () => {
    const { resolveRuntimeOptions } = await loadIndexModule();

    expect(() =>
      resolveRuntimeOptions(["--action", "clock-in", "--execution-mode", "manual"], {})
    ).toThrow(/KAIROS_EMAIL and KAIROS_PASSWORD/i);
  });
});
