import { fileURLToPath } from "node:url";

import { DateTime } from "luxon";

import holidays from "../config/holidays-2026.json" with { type: "json" };
import { BRAZIL_TZ, msUntilTarget, shouldSkipToday } from "./calendar.ts";
import { punch } from "./kairos.ts";

async function main() {
  const isScheduled = process.argv.includes("--schedule");
  const now = DateTime.now().setZone(BRAZIL_TZ);

  console.log(
    `[kairos] mode=${isScheduled ? "schedule" : "manual"} time=${now.toISO()}`
  );

  if (isScheduled) {
    const skipReason = shouldSkipToday(now, holidays);

    if (skipReason) {
      console.log(`[kairos] Skipping: ${skipReason}`);
      return;
    }

    const waitMs = msUntilTarget(now);

    if (waitMs > 0) {
      console.log(
        `[kairos] Waiting ${Math.round(waitMs / 1000)}s until target time.`
      );
      await new Promise((resolve) => setTimeout(resolve, waitMs));
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
