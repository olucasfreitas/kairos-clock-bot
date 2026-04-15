import { fileURLToPath } from "node:url";

import { BRAZIL_TZ, formatTimestamp } from "./calendar.js";
import { punch } from "./kairos.js";

export async function runPunch(options = {}) {
  const email = process.env.KAIROS_EMAIL?.trim();
  const password = process.env.KAIROS_PASSWORD?.trim();

  if (!email || !password) {
    throw new Error("KAIROS_EMAIL and KAIROS_PASSWORD are required.");
  }

  await punch(email, password, options);
  console.log("[kairos] Punch recorded successfully.");
}

export async function main() {
  console.log(
    `[kairos] mode=manual time=${formatTimestamp(new Date())} ${BRAZIL_TZ}`
  );
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
