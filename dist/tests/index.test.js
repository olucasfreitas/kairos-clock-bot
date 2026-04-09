import { DateTime } from "luxon";
import { describe, expect, test } from "vitest";
async function loadIndexModule() {
    const indexModule = await import("../src/index.js").catch(() => undefined);
    expect(indexModule).toBeDefined();
    return indexModule;
}
describe("resolveRuntimeOptions", () => {
    test("maps the morning schedule to a clock-in run", async () => {
        const { resolveRuntimeOptions } = await loadIndexModule();
        const result = resolveRuntimeOptions(["--action", "clock-in", "--execution-mode", "schedule"], {
            GITHUB_EVENT_NAME: "schedule",
            KAIROS_EMAIL: "user@example.com",
            KAIROS_PASSWORD: "super-secret"
        });
        expect(result.action).toBe("clock-in");
        expect(result.dryRun).toBe(false);
    });
    test("maps the evening schedule to a clock-out run", async () => {
        const { resolveRuntimeOptions } = await loadIndexModule();
        const result = resolveRuntimeOptions(["--action", "clock-out", "--execution-mode", "schedule"], {
            GITHUB_EVENT_NAME: "schedule",
            KAIROS_EMAIL: "user@example.com",
            KAIROS_PASSWORD: "super-secret"
        });
        expect(result.action).toBe("clock-out");
        expect(result.dryRun).toBe(false);
    });
    test("lets manual dry-runs execute without a schedule action", async () => {
        const { resolveRuntimeOptions } = await loadIndexModule();
        const result = resolveRuntimeOptions(["--execution-mode", "manual", "--dry-run"], {
            GITHUB_EVENT_NAME: "workflow_dispatch",
            KAIROS_EMAIL: "user@example.com",
            KAIROS_PASSWORD: "super-secret"
        });
        expect(result.action).toBeUndefined();
        expect(result.dryRun).toBe(true);
    });
    test("allows live manual workflow dispatch runs without extra force flags", async () => {
        const { resolveRuntimeOptions } = await loadIndexModule();
        const result = resolveRuntimeOptions(["--execution-mode", "manual"], {
            GITHUB_EVENT_NAME: "workflow_dispatch",
            KAIROS_EMAIL: "user@example.com",
            KAIROS_PASSWORD: "super-secret"
        });
        expect(result.action).toBeUndefined();
        expect(result.dryRun).toBe(false);
        expect(result.executionMode).toBe("manual");
    });
    test("rejects reruns of live attempts", async () => {
        const { resolveRuntimeOptions } = await loadIndexModule();
        expect(() => resolveRuntimeOptions(["--execution-mode", "manual"], {
            GITHUB_EVENT_NAME: "workflow_dispatch",
            GITHUB_RUN_ATTEMPT: "2",
            KAIROS_EMAIL: "user@example.com",
            KAIROS_PASSWORD: "super-secret"
        })).toThrow(/rerun/i);
    });
    test("requires the action flag for scheduled runs", async () => {
        const { resolveRuntimeOptions } = await loadIndexModule();
        expect(() => resolveRuntimeOptions(["--execution-mode", "schedule"], {
            KAIROS_EMAIL: "user@example.com",
            KAIROS_PASSWORD: "super-secret"
        })).toThrow(/action/i);
    });
    test("throws when credentials are missing", async () => {
        const { resolveRuntimeOptions } = await loadIndexModule();
        expect(() => resolveRuntimeOptions(["--action", "clock-in", "--execution-mode", "manual"], {})).toThrow(/KAIROS_EMAIL and KAIROS_PASSWORD/i);
    });
});
describe("buildExecutionPlan", () => {
    test("scheduled runs keep the weekday and target-time policy", async () => {
        const { buildExecutionPlan, resolveRuntimeOptions } = await loadIndexModule();
        const options = resolveRuntimeOptions(["--action", "clock-in", "--execution-mode", "schedule"], {
            KAIROS_EMAIL: "user@example.com",
            KAIROS_PASSWORD: "super-secret"
        });
        const result = buildExecutionPlan(options, DateTime.fromISO("2026-04-08T09:57:00", { zone: "America/Sao_Paulo" }));
        expect(result.artifactLabel).toBe("clock-in");
        expect(result.shouldSkip).toBe(false);
        expect(result.waitMs).toBe(180000);
    });
    test("manual runs execute immediately without waiting or skipping", async () => {
        const { buildExecutionPlan, resolveRuntimeOptions } = await loadIndexModule();
        const options = resolveRuntimeOptions(["--execution-mode", "manual"], {
            KAIROS_EMAIL: "user@example.com",
            KAIROS_PASSWORD: "super-secret"
        });
        const result = buildExecutionPlan(options, DateTime.fromISO("2026-11-20T18:57:00", { zone: "America/Sao_Paulo" }));
        expect(result.artifactLabel).toBe("manual");
        expect(result.shouldSkip).toBe(false);
        expect(result.waitMs).toBe(0);
    });
});
