import { fileURLToPath } from "node:url";

import holidays from "../config/holidays-2026.json" with { type: "json" };
import {
  BRAZIL_TZ,
  HOLIDAY_YEAR,
  formatTimestamp,
  msUntilHour,
  shouldSkipToday
} from "./calendar.js";
import { punch } from "./kairos.js";

export async function main() {
  const targetHour = parseTargetHour(process.argv);
  const isScheduled = targetHour !== undefined;
  const now = new Date();

  console.log(
    `[kairos] mode=${isScheduled ? "schedule" : "manual"} time=${formatTimestamp(now)} ${BRAZIL_TZ}`
  );

  if (isScheduled) {
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

    const waitMs = msUntilHour(now, targetHour);

    if (waitMs > 0) {
      console.log(
        `[kairos] Waiting ${Math.round(waitMs / 1000)}s until ${String(targetHour).padStart(2, "0")}:00.`
      );
      await sleep(waitMs);
    }
  }

  const email = process.env.KAIROS_EMAIL?.trim();
  const password = process.env.KAIROS_PASSWORD?.trim();

  if (!email || !password) {
    throw new Error("KAIROS_EMAIL and KAIROS_PASSWORD are required.");
  }

  await punch(email, password);
  console.log("[kairos] Punch recorded successfully.");
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
    return undefined;
  }

  const value = Number(argv[index + 1]);

  if (!Number.isInteger(value) || value < 0 || value > 23) {
    throw new Error("--target-hour must be an integer between 0 and 23.");
  }

  return value;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
