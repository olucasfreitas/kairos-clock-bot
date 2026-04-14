import { fileURLToPath } from "node:url";

import holidays from "../config/holidays-2026.json" with { type: "json" };
import {
  BRAZIL_TZ,
  HOLIDAY_YEAR,
  formatTimestamp,
  shouldSkipToday
} from "./calendar.js";
import { runPunch } from "./index.js";

export async function main() {
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

  await runPunch();
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
