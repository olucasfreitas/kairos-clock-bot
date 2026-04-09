import { fileURLToPath } from "node:url";

import holidays from "../config/holidays-2026.json" with { type: "json" };
import {
  BRAZIL_TZ,
  HOLIDAY_YEAR,
  formatTimestamp,
  msUntilTarget,
  shouldSkipToday,
  targetDateTime
} from "./calendar.js";
import { punch } from "./kairos.js";

const SCHEDULE_LATENESS_LIMIT_MS = 60_000;

export async function main() {
  const argv = process.argv.slice(2);
  const isScheduled = argv.includes("--schedule");
  const targetSlot = parseTargetSlot(argv);
  const now = new Date();

  console.log(
    `[kairos] mode=${isScheduled ? "schedule" : "manual"} time=${formatTimestamp(now)} ${BRAZIL_TZ}`
  );

  if (isScheduled) {
    if (!targetSlot) {
      throw new Error(
        "Scheduled runs require --target-slot morning or --target-slot evening."
      );
    }

    if (now.getFullYear() !== HOLIDAY_YEAR) {
      throw new Error(
        "Scheduled mode currently only has holiday data for 2026. Update config/holidays-2026.json before using it in another year."
      );
    }

    const skipReason = shouldSkipToday(now, holidays);

    if (skipReason) {
      console.log(`[kairos] Skipping: ${skipReason}`);
      return;
    }

    const target = targetDateTime(now, targetSlot);
    const latenessMs = Math.max(0, now.getTime() - target.getTime());

    if (latenessMs > SCHEDULE_LATENESS_LIMIT_MS) {
      console.log(
        `[kairos] Skipping: missed ${targetSlot} target by ${Math.round(latenessMs / 1000)}s.`
      );
      return;
    }

    const waitMs = msUntilTarget(now, targetSlot);

    if (waitMs > 0) {
      console.log(
        `[kairos] Waiting ${Math.round(waitMs / 1000)}s until ${formatTimestamp(target)} ${BRAZIL_TZ}.`
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

function parseTargetSlot(argv) {
  const index = argv.indexOf("--target-slot");

  if (index === -1) {
    return undefined;
  }

  const value = argv[index + 1]?.trim().toLowerCase();

  if (value === "morning" || value === "evening") {
    return value;
  }

  throw new Error("--target-slot must be either morning or evening.");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
