import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

import { DateTime } from "luxon";

import holidays2026 from "../config/holidays-2026.json" with { type: "json" };
import {
  BRAZIL_TIMEZONE,
  buildPunchDecision,
  type PunchAction
} from "./calendar.js";
import { runKairosPunch } from "./kairos.js";

export type ExecutionMode = "local" | "manual" | "schedule";

export interface RuntimeOptions {
  action: PunchAction;
  artifactsDir: string;
  dryRun: boolean;
  email: string;
  enforceScheduleWindow: boolean;
  eventName: string;
  executionMode: ExecutionMode;
  headless: boolean;
  password: string;
  timeoutMs: number;
}

export function resolveRuntimeOptions(
  argv: string[] = process.argv.slice(2),
  env: NodeJS.ProcessEnv = process.env
): RuntimeOptions {
  const { values } = parseArgs({
    args: argv,
    allowPositionals: false,
    options: {
      action: {
        type: "string"
      },
      "artifacts-dir": {
        type: "string"
      },
      "dry-run": {
        type: "boolean",
        default: false
      },
      "execution-mode": {
        type: "string"
      },
      "force-live": {
        type: "boolean",
        default: false
      },
      headful: {
        type: "boolean",
        default: false
      },
      "timeout-ms": {
        type: "string"
      }
    }
  });
  const executionMode = normalizeExecutionMode(values["execution-mode"]);
  const action = normalizeAction(values.action);
  const dryRun = values["dry-run"];
  const forceLive = values["force-live"];
  const runAttempt = parsePositiveInteger(env.GITHUB_RUN_ATTEMPT, 1);
  const email = env.KAIROS_EMAIL?.trim();
  const password = env.KAIROS_PASSWORD?.trim();

  if (!action) {
    throw new Error("The --action flag is required and must be either clock-in or clock-out.");
  }

  if (!executionMode) {
    throw new Error(
      "The --execution-mode flag is required and must be one of schedule, manual, or local."
    );
  }

  if (!email || !password) {
    throw new Error("KAIROS_EMAIL and KAIROS_PASSWORD must both be configured.");
  }

  if (executionMode === "manual" && !dryRun && !forceLive) {
    throw new Error(
      "Live manual runs require --force-live to avoid accidental punches."
    );
  }

  if (!dryRun && runAttempt > 1) {
    throw new Error("Refusing to execute a live rerun attempt.");
  }

  return {
    action,
    artifactsDir: values["artifacts-dir"]?.trim() || env.ARTIFACTS_DIR?.trim() || "artifacts",
    dryRun,
    email,
    enforceScheduleWindow: executionMode === "schedule" && !dryRun,
    eventName: executionModeToEventName(executionMode),
    executionMode,
    headless: values.headful ? false : !parseBoolean(env.HEADFUL),
    password,
    timeoutMs:
      parsePositiveInteger(values["timeout-ms"], 0) ||
      parsePositiveInteger(env.KAIROS_TIMEOUT_MS, 30_000)
  };
}

export async function main(
  argv: string[] = process.argv.slice(2),
  env: NodeJS.ProcessEnv = process.env
) {
  const options = resolveRuntimeOptions(argv, env);
  const now = DateTime.now().setZone(BRAZIL_TIMEZONE);
  const decision = buildPunchDecision({
    action: options.action,
    enforceLatenessWindow: options.enforceScheduleWindow,
    holidays: holidays2026,
    now
  });

  console.log(
    `[kairos] localDate=${decision.localDate} action=${decision.action} dryRun=${options.dryRun}`
  );

  if (decision.shouldSkip) {
    console.log(`[kairos] skipping run because today is a ${decision.skipReason}.`);
    return;
  }

  if (decision.waitMs > 0) {
    console.log(`[kairos] waiting ${decision.waitMs}ms until ${decision.targetIso}.`);
    await sleep(decision.waitMs);
  }

  const result = await runKairosPunch({
    action: options.action,
    artifactsDir: options.artifactsDir,
    dryRun: options.dryRun,
    email: options.email,
    headless: options.headless,
    password: options.password,
    timeoutMs: options.timeoutMs
  });

  console.log(
    `[kairos] run finished action=${result.action} dryRun=${result.dryRun} finalUrl=${result.finalUrl}`
  );

  if (result.screenshotPath) {
    console.log(`[kairos] screenshot=${result.screenshotPath}`);
  }
}

function normalizeAction(value?: string): PunchAction | undefined {
  const normalized = value?.trim().toLowerCase();

  if (normalized === "clock-in" || normalized === "clock-out") {
    return normalized;
  }

  return undefined;
}

function normalizeExecutionMode(value?: string): ExecutionMode | undefined {
  const normalized = value?.trim().toLowerCase();

  if (normalized === "schedule" || normalized === "manual" || normalized === "local") {
    return normalized;
  }

  return undefined;
}

function executionModeToEventName(executionMode: ExecutionMode): string {
  switch (executionMode) {
    case "schedule":
      return "schedule";
    case "manual":
      return "workflow_dispatch";
    default:
      return "local";
  }
}

function parseBoolean(value?: string): boolean {
  return value?.trim().toLowerCase() === "true";
}

function parsePositiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);

  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed;
  }

  return fallback;
}

async function sleep(milliseconds: number) {
  await new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

const isDirectExecution =
  process.argv[1] !== undefined &&
  fileURLToPath(import.meta.url) === process.argv[1];

if (isDirectExecution) {
  main(process.argv.slice(2)).catch((error) => {
    const message = error instanceof Error ? error.message : String(error);

    console.error(`[kairos] ${message}`);
    process.exit(1);
  });
}
