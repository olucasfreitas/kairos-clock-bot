import { fileURLToPath } from "node:url";

import holidays from "../config/holidays-2026.json" with { type: "json" };
import {
  BRAZIL_TZ,
  HOLIDAY_YEAR,
  formatTimestamp,
  msUntilHour,
  targetDateTime,
  shouldSkipToday
} from "./calendar.js";
import { runPunch } from "./index.js";

const ALLOWED_WINDOW_MS = 60_000;
const MAX_ATTEMPTS = 3;
const ATTEMPT_TIMEOUT_MS = 10_000;
const RETRY_DELAY_MS = 5_000;

export async function main() {
  const targetHour = parseTargetHour(process.argv);
  const now = new Date();

  console.log(
    `[kairos] mode=schedule time=${formatTimestamp(now)} ${BRAZIL_TZ}`
  );

  if (now.getFullYear() !== HOLIDAY_YEAR) {
    throw new Error(
      "Holiday data only covers 2026. Update config/holidays-2026.json for another year."
    );
  }

  const skipReason = shouldSkipToday(now, holidays);

  if (skipReason) {
    console.log(`[kairos] Skipping: ${skipReason}`);
    return;
  }

  const target = targetDateTime(now, targetHour);
  const waitMs = msUntilHour(now, targetHour);

  if (waitMs > 0) {
    console.log(
      `[kairos] Waiting ${Math.round(waitMs / 1000)}s until ${String(targetHour).padStart(2, "0")}:00.`
    );
    await sleep(waitMs);
  }

  const deadline = target.getTime() + ALLOWED_WINDOW_MS;

  if (Date.now() > deadline) {
    throw new Error(
      `Scheduled run started after the allowed 60s window for ${String(targetHour).padStart(2, "0")}:00.`
    );
  }

  let lastError;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      console.log(`[kairos] Punch attempt ${attempt}/${MAX_ATTEMPTS}.`);
      await runPunch({
        defaultTimeoutMs: ATTEMPT_TIMEOUT_MS,
        successTimeoutMs: ATTEMPT_TIMEOUT_MS
      });
      return;
    } catch (error) {
      lastError = error;
      const remainingMs = deadline - Date.now();

      console.error(
        `[kairos] Attempt ${attempt}/${MAX_ATTEMPTS} failed: ${
          error instanceof Error ? error.message : error
        }`
      );

      if (attempt === MAX_ATTEMPTS || remainingMs <= 0) {
        break;
      }

      await sleep(Math.min(RETRY_DELAY_MS, remainingMs));
    }
  }

  throw new Error(
    `Failed to punch within 60 seconds of ${String(targetHour).padStart(2, "0")}:00 after ${MAX_ATTEMPTS} attempts. Last error: ${
      lastError instanceof Error ? lastError.message : lastError
    }`
  );
}

const isDirectExecution =
  process.argv[1] !== undefined &&
  fileURLToPath(import.meta.url) === process.argv[1];

if (isDirectExecution) {
  main().catch((error) => {
    console.error(
      `[kairos] ${error instanceof Error ? error.message : error}`
    );
    process.exit(1);
  });
}

function parseTargetHour(argv) {
  const index = argv.indexOf("--target-hour");

  if (index === -1) {
    throw new Error("Scheduled runs require --target-hour (e.g. --target-hour 10).");
  }

  const rawValue = argv[index + 1];

  if (rawValue === undefined) {
    throw new Error("Scheduled runs require a value after --target-hour.");
  }

  const value = Number(rawValue);

  if (!Number.isInteger(value) || value < 0 || value > 23) {
    throw new Error("--target-hour must be an integer between 0 and 23.");
  }

  return value;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
