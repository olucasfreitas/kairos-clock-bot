import { fileURLToPath } from "node:url";

import { DateTime } from "luxon";

import holidays2026 from "../config/holidays-2026.json" with { type: "json" };
import {
  BRAZIL_TIMEZONE,
  buildPunchDecision,
  type PunchAction
} from "./calendar.js";
import { runKairosPunch } from "./kairos.js";

const SCHEDULE_ACTIONS: Record<string, PunchAction> = {
  "57 9 * * 1-5": "clock-in",
  "57 18 * * 1-5": "clock-out"
};

export interface RuntimeOptions {
  action: PunchAction;
  artifactsDir: string;
  dryRun: boolean;
  email: string;
  enforceScheduleWindow: boolean;
  eventName: string;
  headless: boolean;
  password: string;
  timeoutMs: number;
}

export function resolveRuntimeOptions(
  env: NodeJS.ProcessEnv = process.env
): RuntimeOptions {
  const eventName = env.GITHUB_EVENT_NAME?.trim() || "workflow_dispatch";
  const action = resolveAction(env);
  const dryRun = parseBoolean(env.INPUT_DRY_RUN ?? env.DRY_RUN);
  const forceLive = parseBoolean(env.INPUT_FORCE_LIVE);
  const runAttempt = parsePositiveInteger(env.GITHUB_RUN_ATTEMPT, 1);
  const email = env.KAIROS_EMAIL?.trim();
  const password = env.KAIROS_PASSWORD?.trim();

  if (!email || !password) {
    throw new Error("KAIROS_EMAIL and KAIROS_PASSWORD must both be configured.");
  }

  if (eventName === "workflow_dispatch" && !dryRun && !forceLive) {
    throw new Error(
      "Live workflow_dispatch runs require INPUT_FORCE_LIVE=true to avoid accidental punches."
    );
  }

  if (!dryRun && runAttempt > 1) {
    throw new Error("Refusing to execute a live rerun attempt.");
  }

  return {
    action,
    artifactsDir: env.ARTIFACTS_DIR?.trim() || "artifacts",
    dryRun,
    email,
    enforceScheduleWindow: eventName === "schedule" && !dryRun,
    eventName,
    headless: !parseBoolean(env.HEADFUL),
    password,
    timeoutMs: parsePositiveInteger(env.KAIROS_TIMEOUT_MS, 30_000)
  };
}

export async function main(env: NodeJS.ProcessEnv = process.env) {
  const options = resolveRuntimeOptions(env);
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

function resolveAction(env: NodeJS.ProcessEnv): PunchAction {
  const explicitAction = normalizeAction(env.INPUT_ACTION ?? env.PUNCH_ACTION);

  if (explicitAction) {
    return explicitAction;
  }

  const schedule = env.GITHUB_EVENT_SCHEDULE?.trim();

  if (schedule && SCHEDULE_ACTIONS[schedule]) {
    return SCHEDULE_ACTIONS[schedule];
  }

  throw new Error(
    "Unable to determine the punch action. Set INPUT_ACTION, PUNCH_ACTION, or GITHUB_EVENT_SCHEDULE."
  );
}

function normalizeAction(value?: string): PunchAction | undefined {
  const normalized = value?.trim().toLowerCase();

  if (normalized === "clock-in" || normalized === "clock-out") {
    return normalized;
  }

  return undefined;
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
  main().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);

    console.error(`[kairos] ${message}`);
    process.exit(1);
  });
}
